import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { FilterCategory } from '../filters/entities/filter-category.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Teacher } from '../schedule/entities/teacher.entity';
import { Workload } from '../schedule/entities/workload.entity';
import { ScheduleVersion } from '../schedule/entities/schedule-version.entity';
import { ScheduleLesson } from '../schedule/entities/schedule-lesson.entity';
import { ScheduleStatus } from '../schedule/entities/enums';
import { Task } from '../tasks/entities/task.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';

/** Строка нагрузки: предмет и сколько часов в неделю он занимает. */
export interface SubjectLoad {
    subject: string;
    hours: number;
    classes: string[];
}

/**
 * Данные о сотрудниках школы для раздела «Пользователи».
 *
 * Роли и часы берём из модуля расписания: пользователь приложения и карточка
 * учителя — разные сущности, связанные только по ФИО, поэтому сопоставляем их
 * по нормализованному имени (регистр, лишние пробелы, «ё»). У кого карточки
 * учителя нет (завуч, библиотекарь, новый сотрудник), остаются только
 * категории, выбранные при входе.
 */
@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserProfile)
        private readonly profilesRepo: Repository<UserProfile>,
        @InjectRepository(UserCategory)
        private readonly userCategoriesRepo: Repository<UserCategory>,
        @InjectRepository(FilterCategory)
        private readonly categoriesRepo: Repository<FilterCategory>,
        @InjectRepository(Admin)
        private readonly adminsRepo: Repository<Admin>,
        @InjectRepository(Teacher)
        private readonly teachersRepo: Repository<Teacher>,
        @InjectRepository(Workload)
        private readonly workloadsRepo: Repository<Workload>,
        @InjectRepository(ScheduleVersion)
        private readonly versionsRepo: Repository<ScheduleVersion>,
        @InjectRepository(ScheduleLesson)
        private readonly lessonsRepo: Repository<ScheduleLesson>,
        @InjectRepository(Task)
        private readonly tasksRepo: Repository<Task>,
        @InjectRepository(TaskCompletion)
        private readonly completionsRepo: Repository<TaskCompletion>,
    ) {}

    /** ФИО пишут по-разному, поэтому сравниваем по «спрямлённой» форме. */
    private normalizeName(name: string): string {
        return (name || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Расписание, по которому считаем нагрузку: сначала отмеченное активным,
     * затем последнее опубликованное, в крайнем случае — самое свежее.
     */
    private async findActiveVersion(schoolId: number): Promise<ScheduleVersion | null> {
        const versions = await this.versionsRepo.find({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
        if (versions.length === 0) return null;
        return (
            versions.find((v) => v.isActive) ||
            versions.find((v) => v.status === ScheduleStatus.PUBLISHED) ||
            versions[0]
        );
    }

    /** Категории (роли) всех пользователей школы одним запросом. */
    private async loadCategoriesByProfile(schoolId: number): Promise<Map<number, string[]>> {
        const rows = await this.userCategoriesRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.userProfile', 'p')
            .innerJoin('uc.category', 'c')
            .select('uc.userProfileId', 'profileId')
            .addSelect('c.categoryName', 'name')
            .where('p.schoolId = :schoolId', { schoolId })
            .getRawMany();

        const map = new Map<number, string[]>();
        for (const r of rows) {
            const id = Number(r.profileId);
            const list = map.get(id) || [];
            list.push(r.name);
            map.set(id, list);
        }
        for (const list of map.values()) list.sort((a, b) => a.localeCompare(b, 'ru'));
        return map;
    }

    /** Нагрузка активного расписания, сгруппированная по учителю и предмету. */
    private async loadByTeacher(schoolId: number): Promise<{
        version: ScheduleVersion | null;
        byTeacher: Map<number, SubjectLoad[]>;
    }> {
        const version = await this.findActiveVersion(schoolId);
        const byTeacher = new Map<number, SubjectLoad[]>();
        if (!version) return { version: null, byTeacher };

        const workloads = await this.workloadsRepo.find({
            where: { versionId: version.id },
            relations: ['subject', 'schoolClass', 'group'],
        });

        // Учитель -> предмет -> часы и классы
        const acc = new Map<number, Map<string, { hours: number; classes: Set<string> }>>();
        for (const w of workloads) {
            const teacherId = w.teacherId;
            if (!teacherId) continue;
            const subject = w.subject?.name || 'Без предмета';
            const className = w.group?.name
                ? `${w.schoolClass?.name || ''}${w.group.name ? ` (${w.group.name})` : ''}`.trim()
                : w.schoolClass?.name || '';

            const bySubject =
                acc.get(teacherId) ?? new Map<string, { hours: number; classes: Set<string> }>();
            const cur = bySubject.get(subject) ?? { hours: 0, classes: new Set<string>() };
            cur.hours += w.hoursPerWeek || 0;
            if (className) cur.classes.add(className);
            bySubject.set(subject, cur);
            acc.set(teacherId, bySubject);
        }

        for (const [teacherId, bySubject] of acc) {
            const list: SubjectLoad[] = Array.from(bySubject.entries())
                .map(([subject, v]) => ({
                    subject,
                    hours: v.hours,
                    classes: Array.from(v.classes).sort((a, b) => a.localeCompare(b, 'ru')),
                }))
                .sort((a, b) => b.hours - a.hours || a.subject.localeCompare(b.subject, 'ru'));
            byTeacher.set(teacherId, list);
        }

        return { version, byTeacher };
    }

    /**
     * Список пользователей школы с ролями и недельной нагрузкой.
     */
    async getOverview(schoolId: number) {
        const [profiles, teachers, categoriesByProfile, admins] = await Promise.all([
            this.profilesRepo.find({ where: { schoolId }, order: { fullName: 'ASC' } }),
            this.teachersRepo.find({ where: { schoolId } }),
            this.loadCategoriesByProfile(schoolId),
            this.adminsRepo.find({ where: { schoolId } }),
        ]);

        const { version, byTeacher } = await this.loadByTeacher(schoolId);

        const teacherByName = new Map<string, Teacher>();
        for (const t of teachers) teacherByName.set(this.normalizeName(t.fullName), t);
        const adminNames = new Set(admins.map((a) => this.normalizeName(a.fullName)));

        const users = profiles.map((p) => {
            const key = this.normalizeName(p.fullName);
            const teacher = teacherByName.get(key) || null;
            const load = teacher ? byTeacher.get(teacher.id) || [] : [];
            return {
                id: p.id,
                fullName: p.fullName,
                approved: (p as any).approved,
                createdAt: p.createdAt,
                isAdmin: adminNames.has(key),
                categories: categoriesByProfile.get(p.id) || [],
                load,
                totalHours: load.reduce((sum, l) => sum + l.hours, 0),
                hasTeacherCard: Boolean(teacher),
            };
        });

        return {
            users,
            scheduleVersion: version ? { id: version.id, name: version.name } : null,
        };
    }

    /**
     * Карточка одного пользователя: роли, нагрузка, уроки недели и задачи.
     */
    async getCard(schoolId: number, profileId: number) {
        const profile = await this.profilesRepo.findOne({ where: { id: profileId, schoolId } });
        if (!profile) throw new NotFoundException('Пользователь не найден');

        const key = this.normalizeName(profile.fullName);
        const [teachers, admins] = await Promise.all([
            this.teachersRepo.find({ where: { schoolId } }),
            this.adminsRepo.find({ where: { schoolId } }),
        ]);
        const teacher = teachers.find((t) => this.normalizeName(t.fullName) === key) || null;

        const categoriesByProfile = await this.loadCategoriesByProfile(schoolId);
        const categories = categoriesByProfile.get(profile.id) || [];

        const { version, byTeacher } = await this.loadByTeacher(schoolId);
        const load = teacher ? byTeacher.get(teacher.id) || [] : [];

        const lessons = teacher && version ? await this.loadLessons(version.id, teacher.id) : [];
        const taskStats = await this.getTaskStats(schoolId, profile, categories);

        return {
            id: profile.id,
            fullName: profile.fullName,
            approved: (profile as any).approved,
            createdAt: profile.createdAt,
            isAdmin: admins.some((a) => this.normalizeName(a.fullName) === key),
            categories,
            load,
            totalHours: load.reduce((sum, l) => sum + l.hours, 0),
            teacher: teacher
                ? {
                      id: teacher.id,
                      shortName: teacher.shortName,
                      email: teacher.email || null,
                      phone: teacher.phone || null,
                      maxLessonsPerDay: teacher.maxLessonsPerDay,
                      isActive: teacher.isActive,
                  }
                : null,
            scheduleVersion: version ? { id: version.id, name: version.name } : null,
            lessons,
            taskStats,
        };
    }

    /** Уроки учителя в выбранной версии расписания. */
    private async loadLessons(versionId: number, teacherId: number) {
        const rows = await this.lessonsRepo
            .createQueryBuilder('l')
            .innerJoin('l.workload', 'w')
            .leftJoin('w.subject', 's')
            .leftJoin('w.schoolClass', 'c')
            .leftJoin('w.group', 'g')
            .leftJoin('l.room', 'r')
            .select('l.dayOfWeek', 'dayOfWeek')
            .addSelect('l.lessonNumber', 'lessonNumber')
            .addSelect('l.weekType', 'weekType')
            .addSelect('s.name', 'subject')
            .addSelect('c.name', 'className')
            .addSelect('g.name', 'groupName')
            .addSelect('r.name', 'room')
            .where('l.versionId = :versionId', { versionId })
            .andWhere('w.teacherId = :teacherId', { teacherId })
            .orderBy('l.dayOfWeek', 'ASC')
            .addOrderBy('l.lessonNumber', 'ASC')
            .getRawMany();

        return rows.map((r) => ({
            dayOfWeek: Number(r.dayOfWeek),
            lessonNumber: Number(r.lessonNumber),
            weekType: r.weekType,
            subject: r.subject || '',
            className: r.groupName ? `${r.className || ''} (${r.groupName})` : r.className || '',
            room: r.room || null,
        }));
    }

    /**
     * Сводка по задачам пользователя: сколько адресовано, выполнено, в срок
     * и сколько просрочено без отметки.
     */
    private async getTaskStats(schoolId: number, profile: UserProfile, categories: string[]) {
        // Задачи, адресованные пользователю лично или через его категории.
        // Чужие личные задачи в выборку не попадают.
        const qb = this.tasksRepo
            .createQueryBuilder('t')
            .leftJoin('t.assignees', 'a')
            .where('t.schoolId = :schoolId', { schoolId })
            .andWhere(
                new Brackets((q) => {
                    q.where('a.assigneeUser = :name', { name: profile.fullName });
                    if (categories.length > 0) {
                        q.orWhere('a.assigneeCategory IN (:...cats)', { cats: categories });
                    }
                }),
            )
            .andWhere(
                new Brackets((q) => {
                    q.where('t.isPersonal = false').orWhere('t.creatorName = :owner', {
                        owner: profile.fullName,
                    });
                }),
            );

        const assigned = await qb.getMany();
        const assignedIds = assigned.map((t) => t.id);

        const completions = assignedIds.length
            ? await this.completionsRepo.find({
                  where: { userProfileId: profile.id, taskId: In(assignedIds) },
              })
            : [];

        const deadlineById = new Map(assigned.map((t) => [t.id, new Date(t.deadline).getTime()]));
        const completedIds = new Set(completions.map((c) => c.taskId));
        const onTime = completions.filter((c) => {
            const deadline = deadlineById.get(c.taskId);
            return deadline !== undefined && new Date(c.completedAt).getTime() <= deadline;
        }).length;

        const now = Date.now();
        const overdue = assigned.filter(
            (t) => !completedIds.has(t.id) && new Date(t.deadline).getTime() < now,
        ).length;

        const created = await this.tasksRepo.count({
            where: { schoolId, creatorName: profile.fullName },
        });

        return {
            assigned: assigned.length,
            completed: completedIds.size,
            onTime,
            late: completedIds.size - onTime,
            overdue,
            created,
            completionRate:
                assigned.length > 0 ? Math.round((completedIds.size / assigned.length) * 100) : 0,
        };
    }
}
