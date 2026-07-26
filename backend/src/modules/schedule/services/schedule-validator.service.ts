import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Workload, WorkloadWeekType } from '../entities/workload.entity';
import { ScheduleConflict, ConflictType, ConflictCategory } from '../entities/schedule-conflict.entity';
import { SanpinRulesService } from '../solver/sanpin-rules.service';
import { CheckPlacementDto } from '../dto/schedule.dto';

export interface ConflictInfo {
    type: ConflictType;
    reason: string;
    conflictingLesson?: ScheduleLesson;
}

@Injectable()
export class ScheduleValidatorService {
    constructor(
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Workload)
        private workloadRepo: Repository<Workload>,
        @InjectRepository(ScheduleConflict)
        private conflictRepo: Repository<ScheduleConflict>,
        private sanpinService: SanpinRulesService,
    ) {}

    /** Смена класса нагрузки (по умолчанию 1). Разные смены идут в разное время. */
    private shiftOf(w?: Workload): number {
        return ((w?.schoolClass as any)?.shift) || 1;
    }

    /** Все учителя нагрузки: основной + дополнительные (совместное преподавание). */
    private involvedTeachers(w?: Workload): number[] {
        if (!w) return [];
        const extra = ((w as any).additionalTeacherIds || []) as (number | string)[];
        return [...new Set([w.teacherId, ...extra.map((x) => Number(x))])];
    }

    /** Все классы нагрузки: основной + дополнительные (объединённый урок/поток). */
    private involvedClasses(w?: Workload): Array<{ classId: number; groupId: number }> {
        if (!w) return [];
        const extra = ((w as any).additionalClassIds || []) as (number | string)[];
        return [{ classId: w.classId, groupId: w.groupId || 0 }, ...extra.map((id) => ({ classId: Number(id), groupId: 0 }))];
    }

    /** Пересекаются ли занятые классы двух нагрузок (с учётом подгрупп). */
    private classesConflict(a: Workload, b: Workload): boolean {
        const ca = this.involvedClasses(a);
        const cb = this.involvedClasses(b);
        for (const x of ca) {
            for (const y of cb) {
                if (x.classId !== y.classId) continue;
                const lg = y.groupId || 0;
                const wg = x.groupId || 0;
                if (lg === 0 || wg === 0 || lg === wg) return true;
            }
        }
        return false;
    }

    // Проверить возможность размещения урока
    async checkPlacement(dto: CheckPlacementDto, schoolId?: number): Promise<{
        canPlace: boolean;
        conflicts: ConflictInfo[];
    }> {
        const workload = await this.workloadRepo.findOne({
            where: { id: dto.workloadId },
            relations: ['schoolClass', 'teacher', 'subject', 'version'],
        });

        // ИСПРАВЛЕНО: без проверки школы можно было выяснять расстановку
        // чужого расписания, подставляя чужой id нагрузки
        if (!workload || (schoolId !== undefined && workload.version?.schoolId !== schoolId)) {
            return { canPlace: false, conflicts: [{ type: ConflictType.HARD, reason: 'Нагрузка не найдена' }] };
        }

        const conflicts: ConflictInfo[] = [];
        const myShift = this.shiftOf(workload);
        const myTeachers = this.involvedTeachers(workload);

        // Все уроки в этом слоте
        const slotLessons = await this.lessonRepo.find({
            where: {
                versionId: workload.versionId,
                dayOfWeek: dto.dayOfWeek,
                lessonNumber: dto.lessonNumber,
            },
            relations: ['workload', 'workload.teacher', 'workload.schoolClass', 'room'],
        });

        // Фильтруем по типу недели И по смене (разные смены — разное время)
        const weekType = dto.weekType || WorkloadWeekType.BOTH;
        const relevantLessons = slotLessons.filter(l => {
            if (dto.excludeLessonId && l.id === dto.excludeLessonId) return false;
            if (this.shiftOf(l.workload) !== myShift) return false;
            if (weekType === WorkloadWeekType.BOTH || l.weekType === WorkloadWeekType.BOTH) return true;
            return l.weekType === weekType;
        });

        // Конфликт учителя (осн + доп для совместного преподавания)
        const teacherConflict = relevantLessons.find(l =>
            this.involvedTeachers(l.workload).some(t => myTeachers.includes(t)),
        );
        if (teacherConflict) {
            conflicts.push({
                type: ConflictType.HARD,
                reason: `${workload.teacher.shortName} уже ведёт урок в ${teacherConflict.workload.schoolClass.name}`,
                conflictingLesson: teacherConflict,
            });
        }

        // Конфликт класса (осн + доп для объединённого урока/потока)
        const classConflict = relevantLessons.find(l => this.classesConflict(workload, l.workload));
        if (classConflict) {
            conflicts.push({
                type: ConflictType.HARD,
                reason: `${workload.schoolClass.name} уже имеет урок ${classConflict.workload.subject?.name || ''}`,
                conflictingLesson: classConflict,
            });
        }

        // Конфликт кабинета
        if (dto.roomId) {
            const roomConflict = relevantLessons.find(l => l.roomId === dto.roomId);
            if (roomConflict) {
                conflicts.push({
                    type: ConflictType.HARD,
                    reason: `Кабинет занят классом ${roomConflict.workload.schoolClass.name}`,
                    conflictingLesson: roomConflict,
                });
            }
        }

        // СанПиН: максимум уроков в день для КЛАССА
        const dayLessons = await this.lessonRepo.find({
            where: { versionId: workload.versionId, dayOfWeek: dto.dayOfWeek },
            relations: ['workload'],
        });
        const classPeriods = new Set<number>();
        for (const l of dayLessons) {
            if (dto.excludeLessonId && l.id === dto.excludeLessonId) continue;
            if (l.workload.classId === workload.classId) classPeriods.add(l.lessonNumber);
        }
        const maxLessons =
            (workload.schoolClass as any)?.maxLessonsPerDay ||
            this.sanpinService.getMaxLessonsPerDay(workload.schoolClass.gradeLevel);
        if (!classPeriods.has(dto.lessonNumber) && classPeriods.size >= maxLessons) {
            conflicts.push({
                type: ConflictType.HARD,
                reason: `Превышен максимум уроков в день (${maxLessons}) для ${workload.schoolClass.name} по СанПиН`,
            });
        }

        // СанПиН: размещение сложных предметов
        const subjectValidation = this.sanpinService.validateLessonPlacement(
            workload.subject,
            dto.lessonNumber,
            workload.schoolClass.gradeLevel,
        );
        for (const violation of subjectValidation.violations) {
            conflicts.push({
                type: violation.type === 'hard' ? ConflictType.HARD : ConflictType.SOFT,
                reason: violation.description,
            });
        }

        const hasHardConflicts = conflicts.some(c => c.type === ConflictType.HARD);
        return { canPlace: !hasHardConflicts, conflicts };
    }

    // Предложения по размещению
    async getSuggestions(workloadId: number, schoolId: number): Promise<{
        dayOfWeek: number;
        lessonNumber: number;
        weekType: WorkloadWeekType;
        quality: number;
    }[]> {
        const workload = await this.workloadRepo.findOne({
            where: { id: workloadId },
            relations: ['version'],
        });
        if (!workload) return [];

        const suggestions: { dayOfWeek: number; lessonNumber: number; weekType: WorkloadWeekType; quality: number }[] = [];
        for (let day = 1; day <= 5; day++) {
            for (let lesson = 1; lesson <= 7; lesson++) {
                const result = await this.checkPlacement({ workloadId, dayOfWeek: day, lessonNumber: lesson, weekType: WorkloadWeekType.BOTH });
                if (result.canPlace) {
                    const softConflicts = result.conflicts.filter(c => c.type === ConflictType.SOFT).length;
                    suggestions.push({ dayOfWeek: day, lessonNumber: lesson, weekType: WorkloadWeekType.BOTH, quality: Math.max(0, 100 - softConflicts * 20) });
                }
            }
        }
        suggestions.sort((a, b) => b.quality - a.quality);
        return suggestions.slice(0, 10);
    }

    async getAvailableSlots(workloadId: number, schoolId: number) {
        return this.getSuggestions(workloadId, schoolId);
    }

    async getConflictsForLesson(lessonId: number): Promise<ScheduleConflict[]> {
        return this.conflictRepo
            .createQueryBuilder('conflict')
            .where('conflict.affectedLessons LIKE :pattern', { pattern: `%${lessonId}%` })
            .orderBy('conflict.type', 'ASC')
            .addOrderBy('conflict.severity', 'DESC')
            .getMany();
    }

    // Валидация всей версии расписания
    async validateVersion(versionId: number, schoolId: number): Promise<{
        isValid: boolean;
        hardConstraintViolations: any[];
        softConstraintViolations: any[];
        statistics: any;
    }> {
        await this.conflictRepo.delete({ versionId });

        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'workload.schoolClass', 'workload.teacher', 'workload.subject', 'room'],
        });

        const hardViolations: any[] = [];
        const softViolations: any[] = [];

        // Группируем по (день-урок-неделя)
        const slotMap = new Map<string, ScheduleLesson[]>();
        for (const lesson of lessons) {
            const key = `${lesson.dayOfWeek}-${lesson.lessonNumber}-${lesson.weekType}`;
            if (!slotMap.has(key)) slotMap.set(key, []);
            slotMap.get(key)!.push(lesson);
        }

        for (const [, slotLessons] of slotMap) {
            // Конфликты учителей — осн + доп, с учётом смены (учитель+смена)
            const teacherGroups = new Map<string, ScheduleLesson[]>();
            for (const l of slotLessons) {
                const shift = this.shiftOf(l.workload);
                for (const t of this.involvedTeachers(l.workload)) {
                    const k = `${t}-${shift}`;
                    if (!teacherGroups.has(k)) teacherGroups.set(k, []);
                    teacherGroups.get(k)!.push(l);
                }
            }
            for (const [, group] of teacherGroups) {
                if (group.length > 1) {
                    hardViolations.push({
                        rule: 'TEACHER_CONFLICT',
                        category: ConflictCategory.TEACHER_CONFLICT,
                        description: `${group[0].workload.teacher.shortName} ведёт несколько уроков одновременно`,
                        affectedObjects: group.map(l => l.workload.schoolClass.name),
                        affectedLessons: group.map(l => l.id),
                        dayOfWeek: slotLessons[0].dayOfWeek,
                        lessonNumber: slotLessons[0].lessonNumber,
                    });
                }
            }

            // Конфликты классов — осн + доп (объединённые уроки), с учётом подгрупп
            const classGroups = new Map<number, { lesson: ScheduleLesson; groupId: number }[]>();
            for (const l of slotLessons) {
                for (const c of this.involvedClasses(l.workload)) {
                    if (!classGroups.has(c.classId)) classGroups.set(c.classId, []);
                    classGroups.get(c.classId)!.push({ lesson: l, groupId: c.groupId });
                }
            }
            for (const [classId, entries] of classGroups) {
                if (entries.length < 2) continue;
                const groupIds = entries.map(e => e.groupId);
                const hasWhole = groupIds.includes(0);
                const hasDupGroup = groupIds.some((g, i) => g !== 0 && groupIds.indexOf(g) !== i);
                if (hasWhole || hasDupGroup) {
                    const named = entries.find(e => e.lesson.workload.classId === classId);
                    const cname = named?.lesson.workload.schoolClass?.name || `класс #${classId}`;
                    hardViolations.push({
                        rule: 'CLASS_CONFLICT',
                        category: ConflictCategory.CLASS_CONFLICT,
                        description: `${cname} имеет несколько уроков одновременно`,
                        affectedObjects: entries.map(e => e.lesson.workload.subject?.name || ''),
                        affectedLessons: [...new Set(entries.map(e => e.lesson.id))],
                        dayOfWeek: slotLessons[0].dayOfWeek,
                        lessonNumber: slotLessons[0].lessonNumber,
                    });
                }
            }

            // Конфликты кабинетов — с учётом смены (кабинет+смена)
            const roomGroups = new Map<string, ScheduleLesson[]>();
            for (const l of slotLessons) {
                if (!l.roomId) continue;
                const k = `${l.roomId}-${this.shiftOf(l.workload)}`;
                if (!roomGroups.has(k)) roomGroups.set(k, []);
                roomGroups.get(k)!.push(l);
            }
            for (const [, group] of roomGroups) {
                if (group.length > 1) {
                    hardViolations.push({
                        rule: 'ROOM_CONFLICT',
                        category: ConflictCategory.ROOM_CONFLICT,
                        description: `Кабинет ${group[0].room?.name} занят несколькими классами`,
                        affectedObjects: group.map(l => l.workload.schoolClass.name),
                        affectedLessons: group.map(l => l.id),
                        dayOfWeek: slotLessons[0].dayOfWeek,
                        lessonNumber: slotLessons[0].lessonNumber,
                    });
                }
            }
        }

        for (const violation of hardViolations) {
            await this.conflictRepo.save(this.conflictRepo.create({
                versionId,
                type: ConflictType.HARD,
                category: violation.category,
                description: violation.description,
                affectedLessons: violation.affectedLessons,
                severity: 10,
                dayOfWeek: violation.dayOfWeek,
                lessonNumber: violation.lessonNumber,
            }));
        }

        return {
            isValid: hardViolations.length === 0,
            hardConstraintViolations: hardViolations,
            softConstraintViolations: softViolations,
            statistics: {
                totalLessons: lessons.length,
                hardConflicts: hardViolations.length,
                softConflicts: softViolations.length,
            },
        };
    }
}
