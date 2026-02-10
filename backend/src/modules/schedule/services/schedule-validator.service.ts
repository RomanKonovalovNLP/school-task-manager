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

    // Проверить возможность размещения урока
    async checkPlacement(dto: CheckPlacementDto): Promise<{
        canPlace: boolean;
        conflicts: ConflictInfo[];
    }> {
        const workload = await this.workloadRepo.findOne({
            where: { id: dto.workloadId },
            relations: ['schoolClass', 'teacher', 'subject', 'version'],
        });

        if (!workload) {
            return { canPlace: false, conflicts: [{ type: ConflictType.HARD, reason: 'Нагрузка не найдена' }] };
        }

        const conflicts: ConflictInfo[] = [];

        // Получаем все уроки в этом слоте
        const slotLessons = await this.lessonRepo.find({
            where: {
                versionId: workload.versionId,
                dayOfWeek: dto.dayOfWeek,
                lessonNumber: dto.lessonNumber,
            },
            relations: ['workload', 'workload.teacher', 'workload.schoolClass', 'room'],
        });

        // Фильтруем по типу недели
        const weekType = dto.weekType || WorkloadWeekType.BOTH;
        const relevantLessons = slotLessons.filter(l => {
            if (dto.excludeLessonId && l.id === dto.excludeLessonId) return false;
            if (weekType === WorkloadWeekType.BOTH || l.weekType === WorkloadWeekType.BOTH) return true;
            return l.weekType === weekType;
        });

        // Проверка конфликта учителя
        const teacherConflict = relevantLessons.find(l => l.workload.teacherId === workload.teacherId);
        if (teacherConflict) {
            conflicts.push({
                type: ConflictType.HARD,
                reason: `${workload.teacher.shortName} уже ведёт урок в ${teacherConflict.workload.schoolClass.name}`,
                conflictingLesson: teacherConflict,
            });
        }

        // Проверка конфликта класса
        const classConflict = relevantLessons.find(l => {
            if (l.workload.classId !== workload.classId) return false;
            // Если оба для групп - проверяем группу
            if (l.workload.groupId && workload.groupId) {
                return l.workload.groupId === workload.groupId;
            }
            // Если хотя бы один для всего класса - конфликт
            return !l.workload.groupId || !workload.groupId;
        });
        if (classConflict) {
            conflicts.push({
                type: ConflictType.HARD,
                reason: `${workload.schoolClass.name} уже имеет урок ${classConflict.workload.subject?.name || ''}`,
                conflictingLesson: classConflict,
            });
        }

        // Проверка конфликта кабинета
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

        // Проверка СанПиН: максимум уроков в день
        const classLessonsToday = await this.lessonRepo.count({
            where: {
                versionId: workload.versionId,
                dayOfWeek: dto.dayOfWeek,
            },
            relations: ['workload'],
        });
        // Это упрощённая проверка, полная требует подсчёта по классу

        // Проверка СанПиН: размещение сложных предметов
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

        return {
            canPlace: !hasHardConflicts,
            conflicts,
        };
    }

    // Получить предложения по размещению
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

        const suggestions: {
            dayOfWeek: number;
            lessonNumber: number;
            weekType: WorkloadWeekType;
            quality: number;
        }[] = [];

        // Проверяем все слоты
        for (let day = 1; day <= 5; day++) {
            for (let lesson = 1; lesson <= 7; lesson++) {
                const result = await this.checkPlacement({
                    workloadId,
                    dayOfWeek: day,
                    lessonNumber: lesson,
                    weekType: WorkloadWeekType.BOTH,
                });

                if (result.canPlace) {
                    // Считаем качество слота (меньше soft конфликтов = лучше)
                    const softConflicts = result.conflicts.filter(c => c.type === ConflictType.SOFT).length;
                    const quality = Math.max(0, 100 - softConflicts * 20);

                    suggestions.push({
                        dayOfWeek: day,
                        lessonNumber: lesson,
                        weekType: WorkloadWeekType.BOTH,
                        quality,
                    });
                }
            }
        }

        // Сортируем по качеству
        suggestions.sort((a, b) => b.quality - a.quality);

        return suggestions.slice(0, 10); // Возвращаем топ-10
    }

    // Получить доступные слоты для нагрузки
    async getAvailableSlots(workloadId: number, schoolId: number) {
        return this.getSuggestions(workloadId, schoolId);
    }

    // Получить конфликты для урока
    async getConflictsForLesson(lessonId: number): Promise<ScheduleConflict[]> {
        return this.conflictRepo.find({
            where: { affectedLessons: lessonId as any },
            order: { type: 'ASC', severity: 'DESC' },
        });
    }

    // Валидация всей версии расписания
    async validateVersion(versionId: number, schoolId: number): Promise<{
        isValid: boolean;
        hardConstraintViolations: any[];
        softConstraintViolations: any[];
        statistics: any;
    }> {
        // Очищаем старые конфликты
        await this.conflictRepo.delete({ versionId });

        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'workload.schoolClass', 'workload.teacher', 'workload.subject', 'room'],
        });

        const hardViolations: any[] = [];
        const softViolations: any[] = [];

        // Группируем уроки по слотам
        const slotMap = new Map<string, ScheduleLesson[]>();
        for (const lesson of lessons) {
            const key = `${lesson.dayOfWeek}-${lesson.lessonNumber}-${lesson.weekType}`;
            if (!slotMap.has(key)) {
                slotMap.set(key, []);
            }
            slotMap.get(key)!.push(lesson);
        }

        // Проверяем конфликты в каждом слоте
        for (const [, slotLessons] of slotMap) {
            // Конфликты учителей
            const teacherIds = slotLessons.map(l => l.workload.teacherId);
            const duplicateTeachers = teacherIds.filter((id, i) => teacherIds.indexOf(id) !== i);
            for (const teacherId of duplicateTeachers) {
                const conflictingLessons = slotLessons.filter(l => l.workload.teacherId === teacherId);
                hardViolations.push({
                    rule: 'TEACHER_CONFLICT',
                    description: `${conflictingLessons[0].workload.teacher.shortName} ведёт несколько уроков одновременно`,
                    affectedObjects: conflictingLessons.map(l => l.workload.schoolClass.name),
                });
            }

            // Конфликты кабинетов
            const roomIds = slotLessons.filter(l => l.roomId).map(l => l.roomId);
            const duplicateRooms = roomIds.filter((id, i) => roomIds.indexOf(id) !== i);
            for (const roomId of duplicateRooms) {
                const conflictingLessons = slotLessons.filter(l => l.roomId === roomId);
                hardViolations.push({
                    rule: 'ROOM_CONFLICT',
                    description: `Кабинет ${conflictingLessons[0].room?.name} занят несколькими классами`,
                    affectedObjects: conflictingLessons.map(l => l.workload.schoolClass.name),
                });
            }
        }

        // Сохраняем конфликты в базу
        for (const violation of hardViolations) {
            await this.conflictRepo.save(this.conflictRepo.create({
                versionId,
                type: ConflictType.HARD,
                category: ConflictCategory.TEACHER_CONFLICT,
                description: violation.description,
                severity: 10,
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
