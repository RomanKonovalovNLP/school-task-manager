import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Substitution } from '../entities/substitution.entity';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Teacher } from '../entities/teacher.entity';
import { Room } from '../entities/room.entity';
import { CreateSubstitutionDto } from '../dto/schedule.dto';

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

@Injectable()
export class SubstitutionsService {
    constructor(
        @InjectRepository(Substitution)
        private substitutionRepo: Repository<Substitution>,
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Teacher)
        private teacherRepo: Repository<Teacher>,
        @InjectRepository(Room)
        private roomRepo: Repository<Room>,
    ) {}

    // Замены по дате (для активного расписания)
    async findByDate(date: string, schoolId: number) {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay() || 7;

        const lessons = await this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.version', 'version')
            .leftJoinAndSelect('workload.schoolClass', 'schoolClass')
            .leftJoinAndSelect('workload.subject', 'subject')
            .leftJoinAndSelect('workload.teacher', 'teacher')
            .leftJoinAndSelect('lesson.room', 'room')
            .where('version.schoolId = :schoolId', { schoolId })
            .andWhere('version.isActive = true')
            .andWhere('lesson.dayOfWeek = :dayOfWeek', { dayOfWeek })
            .orderBy('lesson.lessonNumber', 'ASC')
            .getMany();

        const lessonIds = lessons.map(l => l.id);
        const substitutions = lessonIds.length > 0
            ? await this.substitutionRepo.find({
                where: { lessonId: In(lessonIds), date: dateObj },
                relations: ['newTeacher', 'newRoom', 'newSubject'],
            })
            : [];

        return { date, originalLessons: lessons, substitutions };
    }

    // Все замены конкретной версии расписания (для нижнего списка/отчёта)
    async findByVersion(versionId: number, schoolId: number): Promise<Substitution[]> {
        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: [
                'workload', 'workload.version', 'workload.schoolClass',
                'workload.subject', 'workload.teacher', 'room',
            ],
        });
        if (lessons.length && lessons[0].workload?.version?.schoolId !== schoolId) {
            throw new NotFoundException('Расписание не найдено');
        }
        const lessonIds = lessons.map(l => l.id);
        if (lessonIds.length === 0) return [];

        return this.substitutionRepo.find({
            where: { lessonId: In(lessonIds) },
            relations: [
                'newTeacher', 'newRoom', 'newSubject',
                'lesson', 'lesson.workload', 'lesson.workload.schoolClass',
                'lesson.workload.subject', 'lesson.workload.teacher', 'lesson.room',
            ],
            order: { date: 'DESC', id: 'DESC' },
        });
    }

    async create(dto: CreateSubstitutionDto, createdBy: string, schoolId: number): Promise<Substitution> {
        const lesson = await this.lessonRepo.findOne({
            where: { id: dto.lessonId },
            relations: ['workload', 'workload.version'],
        });
        if (!lesson || lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Урок не найден');
        }

        // ИСПРАВЛЕНО: подставляемые учитель и кабинет должны принадлежать этой же школе,
        // иначе в расписание можно было записать чужого учителя, передав его id
        if (dto.newTeacherId) {
            const teacher = await this.teacherRepo.findOne({
                where: { id: dto.newTeacherId, schoolId } as any,
            });
            if (!teacher) throw new NotFoundException('Учитель не найден');
        }
        if (dto.newRoomId) {
            const room = await this.roomRepo.findOne({
                where: { id: dto.newRoomId, schoolId } as any,
            });
            if (!room) throw new NotFoundException('Кабинет не найден');
        }

        const existing = await this.substitutionRepo.findOne({
            where: { lessonId: dto.lessonId, date: new Date(dto.date) },
        });

        const target: any = existing || this.substitutionRepo.create({
            lessonId: dto.lessonId,
            date: new Date(dto.date),
            createdBy,
        });
        target.newTeacherId = dto.newTeacherId ?? null;
        target.newRoomId = dto.newRoomId ?? null;
        target.newSubjectId = dto.newSubjectId ?? null;
        target.newDayOfWeek = dto.newDayOfWeek ?? null;
        target.newLessonNumber = dto.newLessonNumber ?? null;
        target.newWeekType = dto.newWeekType ?? null;
        target.isCancelled = dto.isCancelled || false;
        target.reason = dto.reason ?? null;

        return this.substitutionRepo.save(target);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const substitution = await this.substitutionRepo.findOne({
            where: { id },
            relations: ['lesson', 'lesson.workload', 'lesson.workload.version'],
        });
        if (!substitution || substitution.lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Замена не найдена');
        }
        await this.substitutionRepo.remove(substitution);
    }

    /**
     * Доступные учителя И кабинеты для подстановки — с учётом занятости в целевом
     * слоте (можно указать другую позицию урока: targetDay/targetLesson).
     */
    async getAvailableForSlot(
        lessonId: number,
        schoolId: number,
        targetDayOfWeek?: number,
        targetLessonNumber?: number,
        date?: string,
    ): Promise<{
        availableTeachers: { id: number; name: string; subjects: string[]; currentLoad: number; suitability: number }[];
        availableRooms: { id: number; name: string; capacity: number; type: string }[];
    }> {
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId },
            relations: ['workload', 'workload.version', 'workload.subject', 'workload.schoolClass'],
        });
        if (!lesson || lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Урок не найден');
        }

        const versionId = lesson.workload.version.id;
        const day = targetDayOfWeek || lesson.dayOfWeek;
        const targetLesson = targetLessonNumber || lesson.lessonNumber;

        // Все уроки версии — замены на дату могут переносить урок из другого дня/позиции
        const allLessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'room'],
        });

        // Замены, уже созданные на выбранную дату (учитываем их при расчёте занятости)
        const subsByLesson = new Map<number, Substitution>();
        if (date && allLessons.length) {
            const subs = await this.substitutionRepo.find({
                where: { lessonId: In(allLessons.map(l => l.id)), date: date as any },
            });
            subs.forEach(sub => subsByLesson.set(sub.lessonId, sub));
        }

        // Эффективное положение урока на дату с учётом замены (null = окно/отменён)
        const effective = (l: ScheduleLesson) => {
            const sub = subsByLesson.get(l.id);
            if (sub && sub.isCancelled) return null;
            return {
                day: (sub && sub.newDayOfWeek != null) ? sub.newDayOfWeek : l.dayOfWeek,
                num: (sub && sub.newLessonNumber != null) ? sub.newLessonNumber : l.lessonNumber,
                teacherId: (sub && sub.newTeacherId != null) ? sub.newTeacherId : l.workload.teacherId,
                roomId: (sub && sub.newRoomId != null) ? sub.newRoomId : l.roomId,
            };
        };

        const effLessons = allLessons
            .map(l => ({ l, e: effective(l) }))
            .filter((x): x is { l: ScheduleLesson; e: { day: number; num: number; teacherId: number; roomId: number } } => x.e !== null);

        // Кто реально занимает целевую позицию на эту дату (кроме заменяемого урока)
        const atSlot = effLessons.filter(x => x.e.day === day && x.e.num === targetLesson && x.l.id !== lessonId);
        const busyTeacherIds = new Set(atSlot.map(x => x.e.teacherId));
        const busyRoomIds = new Set(atSlot.filter(x => x.e.roomId).map(x => x.e.roomId));

        // Нагрузка учителя в этот день по эффективному положению
        const loadByTeacher = new Map<number, number>();
        effLessons
            .filter(x => x.e.day === day)
            .forEach(x => loadByTeacher.set(x.e.teacherId, (loadByTeacher.get(x.e.teacherId) || 0) + 1));

        // Учителя
        const teachers = await this.teacherRepo.find({
            where: { schoolId, isActive: true },
            relations: ['subjects', 'availability'],
        });
        const availableTeachers = teachers
            .map(teacher => {
                const av = teacher.availability?.find(a => a.dayOfWeek === day && a.lessonNumber === targetLesson);
                if (av && !av.isAvailable) return null;
                if (busyTeacherIds.has(teacher.id)) return null;
                const currentLoad = loadByTeacher.get(teacher.id) || 0;
                const teachesSubject = teacher.subjects?.some(sb => sb.id === lesson.workload.subjectId);
                return {
                    id: teacher.id,
                    name: teacher.shortName || teacher.fullName,
                    subjects: teacher.subjects?.map(sb => sb.name) || [],
                    currentLoad,
                    suitability: teachesSubject ? 100 : 50,
                };
            })
            .filter(Boolean) as any[];
        availableTeachers.sort((a, b) => b.suitability - a.suitability || a.currentLoad - b.currentLoad);

        // Кабинеты
        const rooms = await this.roomRepo.find({ where: { schoolId } as any });
        const availableRooms = rooms
            .filter(r => (r as any).isActive !== false && !busyRoomIds.has(r.id))
            .map(r => ({ id: r.id, name: r.name, capacity: r.capacity, type: r.type }));

        return { availableTeachers, availableRooms };
    }

    // Совместимость со старым эндпоинтом
    async getAvailableTeachers(lessonId: number, date: string, schoolId: number) {
        const { availableTeachers } = await this.getAvailableForSlot(lessonId, schoolId, undefined, undefined, date);
        return { availableTeachers };
    }

    // Экспорт отчёта по заменам версии в xlsx
    async exportReport(versionId: number, schoolId: number): Promise<Buffer> {
        const subs = await this.findByVersion(versionId, schoolId);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ПланТакт';
        const ws = wb.addWorksheet('Замены');

        ws.columns = [
            { header: 'Дата', key: 'date', width: 12 },
            { header: 'Класс', key: 'cls', width: 10 },
            { header: 'Урок', key: 'pos', width: 8 },
            { header: 'Было (предмет)', key: 'oldSubj', width: 18 },
            { header: 'Было (учитель)', key: 'oldTeacher', width: 18 },
            { header: 'Было (каб.)', key: 'oldRoom', width: 10 },
            { header: 'Стало (предмет)', key: 'newSubj', width: 18 },
            { header: 'Стало (учитель)', key: 'newTeacher', width: 18 },
            { header: 'Стало (каб.)', key: 'newRoom', width: 10 },
            { header: 'Новая позиция', key: 'newPos', width: 14 },
            { header: 'Причина', key: 'reason', width: 24 },
        ];
        ws.getRow(1).font = { bold: true };

        for (const s of subs) {
            const w = s.lesson?.workload;
            const dateStr = new Date(s.date).toLocaleDateString('ru-RU');
            const newPos = s.newLessonNumber
                ? `${s.newDayOfWeek ? DAYS[s.newDayOfWeek] + ', ' : ''}${s.newLessonNumber} урок${s.newWeekType && s.newWeekType !== 'both' ? ' (' + s.newWeekType + ')' : ''}`
                : '';
            ws.addRow({
                date: dateStr,
                cls: w?.schoolClass?.name || '',
                pos: `${s.lesson?.dayOfWeek ? DAYS[s.lesson.dayOfWeek][0] + DAYS[s.lesson.dayOfWeek][1] + ' ' : ''}${s.lesson?.lessonNumber || ''}`,
                oldSubj: w?.subject?.name || '',
                oldTeacher: w?.teacher?.shortName || '',
                oldRoom: s.lesson?.room?.name || '',
                newSubj: s.isCancelled ? '— ОКНО —' : (s.newSubject?.name || ''),
                newTeacher: s.isCancelled ? '' : (s.newTeacher?.shortName || ''),
                newRoom: s.isCancelled ? '' : (s.newRoom?.name || ''),
                newPos,
                reason: s.reason || '',
            });
        }

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
