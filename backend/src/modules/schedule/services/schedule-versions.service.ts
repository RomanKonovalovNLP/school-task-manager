import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleVersion, ScheduleStatus } from '../entities/schedule-version.entity';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Workload } from '../entities/workload.entity';
import { BellSchedule } from '../entities/bell-schedule.entity';
import { ScheduleConflict, ConflictType } from '../entities/schedule-conflict.entity';
import { CreateScheduleVersionDto, UpdateScheduleVersionDto } from '../dto/schedule.dto';

@Injectable()
export class ScheduleVersionsService {
    constructor(
        @InjectRepository(ScheduleVersion)
        private versionRepo: Repository<ScheduleVersion>,
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Workload)
        private workloadRepo: Repository<Workload>,
        @InjectRepository(BellSchedule)
        private bellRepo: Repository<BellSchedule>,
        @InjectRepository(ScheduleConflict)
        private conflictRepo: Repository<ScheduleConflict>,
    ) {}

    async findAll(schoolId: number): Promise<ScheduleVersion[]> {
        const versions = await this.versionRepo.find({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });

        if (versions.length === 0) return versions;

        // D3: Один запрос вместо N запросов для подсчёта конфликтов
        const conflictCounts = await this.conflictRepo
            .createQueryBuilder('conflict')
            .select('conflict.versionId', 'versionId')
            .addSelect('COUNT(*)', 'count')
            .where('conflict.versionId IN (:...ids)', { ids: versions.map(v => v.id) })
            .andWhere('conflict.type = :type', { type: ConflictType.HARD })
            .andWhere('conflict.isResolved = false')
            .groupBy('conflict.versionId')
            .getRawMany();

        const countMap = new Map(conflictCounts.map(c => [c.versionId, parseInt(c.count)]));

        for (const version of versions) {
            (version as any).conflictsCount = countMap.get(version.id) || 0;
        }

        return versions;
    }

    async findOne(id: number, schoolId: number): Promise<ScheduleVersion> {
        const version = await this.versionRepo.findOne({
            where: { id, schoolId },
        });
        if (!version) {
            throw new NotFoundException('Расписание не найдено');
        }
        return version;
    }

    async findOneWithSchedule(id: number, schoolId: number): Promise<{
        version: ScheduleVersion;
        bellSchedule: BellSchedule[];
        workloads: Workload[];
        lessons: ScheduleLesson[];
        conflicts: ScheduleConflict[];
    }> {
        const version = await this.findOne(id, schoolId);

        const [bellSchedule, workloads, lessons, conflicts] = await Promise.all([
            this.bellRepo.find({
                where: { versionId: id },
                order: { lessonNumber: 'ASC' },
            }),
            this.workloadRepo.find({
                where: { versionId: id },
                relations: ['schoolClass', 'group', 'subject', 'teacher', 'room', 'lessonType', 'lessons'],
            }),
            this.lessonRepo.find({
                where: { versionId: id },
                relations: ['workload', 'workload.schoolClass', 'workload.group', 'workload.subject', 'workload.teacher', 'room'],
                order: { dayOfWeek: 'ASC', lessonNumber: 'ASC' },
            }),
            this.conflictRepo.find({
                where: { versionId: id, isResolved: false },
                order: { type: 'ASC', severity: 'DESC' },
            }),
        ]);

        // Вычисляем placedHours для каждой нагрузки
        const workloadsWithPlaced = workloads.map(w => ({
            ...w,
            placedHours: w.lessons?.length || 0,
            remainingHours: w.hoursPerWeek - (w.lessons?.length || 0),
        }));

        return { version, bellSchedule, workloads: workloadsWithPlaced, lessons, conflicts };
    }

    async create(dto: CreateScheduleVersionDto, schoolId: number): Promise<ScheduleVersion> {
        const version = this.versionRepo.create({
            ...dto,
            schoolId,
            status: ScheduleStatus.DRAFT,
        });

        const savedVersion = await this.versionRepo.save(version);

        // M6: Создаём расписание звонков только если НЕ копируем из существующей версии
        // (copyFromVersion уже скопирует расписание звонков)
        if (!dto.copyFromVersionId) {
            await this.createDefaultBellSchedule(savedVersion.id);
        }

        // Если копируем из существующей версии
        if (dto.copyFromVersionId) {
            await this.copyFromVersion(savedVersion.id, dto.copyFromVersionId, schoolId);
        }

        return savedVersion;
    }

    async update(id: number, dto: UpdateScheduleVersionDto, schoolId: number): Promise<ScheduleVersion> {
        const version = await this.findOne(id, schoolId);
        Object.assign(version, dto);
        return this.versionRepo.save(version);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const version = await this.findOne(id, schoolId);
        await this.versionRepo.remove(version);
    }

    async copy(id: number, name: string, schoolId: number): Promise<ScheduleVersion> {
        const original = await this.findOne(id, schoolId);

        const newVersion = this.versionRepo.create({
            ...original,
            id: undefined,
            name,
            status: ScheduleStatus.DRAFT,
            isActive: false,
            copiedFromId: id,
            createdAt: undefined,
            updatedAt: undefined,
        });

        const savedVersion = await this.versionRepo.save(newVersion);
        await this.copyFromVersion(savedVersion.id, id, schoolId);

        return savedVersion;
    }

    async activate(id: number, schoolId: number): Promise<ScheduleVersion> {
        // Деактивируем все остальные версии
        await this.versionRepo.update(
            { schoolId },
            { isActive: false },
        );

        const version = await this.findOne(id, schoolId);
        version.isActive = true;
        return this.versionRepo.save(version);
    }

    async publish(id: number, schoolId: number): Promise<ScheduleVersion> {
        const version = await this.findOne(id, schoolId);
        
        // Проверяем наличие hard конфликтов
        const hardConflicts = await this.conflictRepo.count({
            where: { versionId: id, type: ConflictType.HARD, isResolved: false },
        });

        if (hardConflicts > 0) {
            throw new ForbiddenException(`Невозможно опубликовать: ${hardConflicts} критических ошибок`);
        }

        version.status = ScheduleStatus.PUBLISHED;
        return this.versionRepo.save(version);
    }

    async checkAccess(id: number, schoolId: number): Promise<void> {
        await this.findOne(id, schoolId);
    }

    // Получить расписание по классам
    async getScheduleByClass(versionId: number, schoolId: number, classId?: number) {
        await this.checkAccess(versionId, schoolId);

        const query = this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.schoolClass', 'schoolClass')
            .leftJoinAndSelect('workload.subject', 'subject')
            .leftJoinAndSelect('workload.teacher', 'teacher')
            .leftJoinAndSelect('lesson.room', 'room')
            .where('lesson.versionId = :versionId', { versionId });

        if (classId) {
            query.andWhere('workload.classId = :classId', { classId });
        }

        return query.orderBy('schoolClass.gradeLevel', 'ASC')
            .addOrderBy('schoolClass.name', 'ASC')
            .addOrderBy('lesson.dayOfWeek', 'ASC')
            .addOrderBy('lesson.lessonNumber', 'ASC')
            .getMany();
    }

    // Получить расписание по учителям
    async getScheduleByTeacher(versionId: number, schoolId: number, teacherId?: number) {
        await this.checkAccess(versionId, schoolId);

        const query = this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.schoolClass', 'schoolClass')
            .leftJoinAndSelect('workload.subject', 'subject')
            .leftJoinAndSelect('workload.teacher', 'teacher')
            .leftJoinAndSelect('lesson.room', 'room')
            .where('lesson.versionId = :versionId', { versionId });

        if (teacherId) {
            query.andWhere('workload.teacherId = :teacherId', { teacherId });
        }

        return query.orderBy('teacher.fullName', 'ASC')
            .addOrderBy('lesson.dayOfWeek', 'ASC')
            .addOrderBy('lesson.lessonNumber', 'ASC')
            .getMany();
    }

    // Получить расписание по кабинетам
    async getScheduleByRoom(versionId: number, schoolId: number, roomId?: number) {
        await this.checkAccess(versionId, schoolId);

        const query = this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.schoolClass', 'schoolClass')
            .leftJoinAndSelect('workload.subject', 'subject')
            .leftJoinAndSelect('workload.teacher', 'teacher')
            .leftJoinAndSelect('lesson.room', 'room')
            .where('lesson.versionId = :versionId', { versionId });

        if (roomId) {
            query.andWhere('lesson.roomId = :roomId', { roomId });
        }

        return query.orderBy('room.name', 'ASC')
            .addOrderBy('lesson.dayOfWeek', 'ASC')
            .addOrderBy('lesson.lessonNumber', 'ASC')
            .getMany();
    }

    // Получить конфликты
    async getConflicts(versionId: number, schoolId: number, filters?: { type?: string; category?: string }) {
        await this.checkAccess(versionId, schoolId);

        const query = this.conflictRepo
            .createQueryBuilder('conflict')
            .where('conflict.versionId = :versionId', { versionId })
            .andWhere('conflict.isResolved = false');

        if (filters?.type) {
            query.andWhere('conflict.type = :type', { type: filters.type });
        }

        if (filters?.category) {
            query.andWhere('conflict.category = :category', { category: filters.category });
        }

        return query.orderBy('conflict.type', 'ASC')
            .addOrderBy('conflict.severity', 'DESC')
            .getMany();
    }

    // Статистика расписания
    async getStatistics(versionId: number, schoolId: number) {
        await this.checkAccess(versionId, schoolId);

        const [lessons, workloads, hardConflicts, softConflicts] = await Promise.all([
            this.lessonRepo.count({ where: { versionId } }),
            this.workloadRepo.find({ where: { versionId }, relations: ['lessons'] }),
            this.conflictRepo.count({ where: { versionId, type: ConflictType.HARD, isResolved: false } }),
            this.conflictRepo.count({ where: { versionId, type: ConflictType.SOFT, isResolved: false } }),
        ]);

        const totalHours = workloads.reduce((sum, w) => sum + w.hoursPerWeek, 0);
        const placedHours = workloads.reduce((sum, w) => sum + (w.lessons?.length || 0), 0);

        return {
            totalLessons: lessons,
            placedLessons: placedHours,
            unplacedWorkload: totalHours - placedHours,
            hardConflicts,
            softConflicts,
            completionPercent: totalHours > 0 ? Math.round((placedHours / totalHours) * 100) : 0,
        };
    }

    // Приватные методы
    private async createDefaultBellSchedule(versionId: number): Promise<void> {
        const defaultSchedule = [
            { lessonNumber: 1, startTime: '08:30', endTime: '09:15', breakAfter: 10 },
            { lessonNumber: 2, startTime: '09:25', endTime: '10:10', breakAfter: 20, name: 'Большая перемена' },
            { lessonNumber: 3, startTime: '10:30', endTime: '11:15', breakAfter: 10 },
            { lessonNumber: 4, startTime: '11:25', endTime: '12:10', breakAfter: 20, name: 'Большая перемена' },
            { lessonNumber: 5, startTime: '12:30', endTime: '13:15', breakAfter: 10 },
            { lessonNumber: 6, startTime: '13:25', endTime: '14:10', breakAfter: 10 },
            { lessonNumber: 7, startTime: '14:20', endTime: '15:05', breakAfter: 10 },
        ];

        for (const item of defaultSchedule) {
            await this.bellRepo.save(this.bellRepo.create({ ...item, versionId }));
        }
    }

    private async copyFromVersion(newVersionId: number, sourceVersionId: number, schoolId: number): Promise<void> {
        // Копируем расписание звонков
        const bells = await this.bellRepo.find({ where: { versionId: sourceVersionId } });
        for (const bell of bells) {
            await this.bellRepo.save(this.bellRepo.create({
                ...bell,
                id: undefined,
                versionId: newVersionId,
            }));
        }

        // Копируем нагрузку
        const workloads = await this.workloadRepo.find({ where: { versionId: sourceVersionId } });
        const workloadMap = new Map<number, number>();

        for (const workload of workloads) {
            const newWorkload = await this.workloadRepo.save(this.workloadRepo.create({
                ...workload,
                id: undefined,
                versionId: newVersionId,
            }));
            workloadMap.set(workload.id, newWorkload.id);
        }

        // Копируем уроки
        const lessons = await this.lessonRepo.find({ where: { versionId: sourceVersionId } });
        for (const lesson of lessons) {
            const newWorkloadId = workloadMap.get(lesson.workloadId);
            if (newWorkloadId) {
                await this.lessonRepo.save(this.lessonRepo.create({
                    ...lesson,
                    id: undefined,
                    versionId: newVersionId,
                    workloadId: newWorkloadId,
                }));
            }
        }
    }
}
