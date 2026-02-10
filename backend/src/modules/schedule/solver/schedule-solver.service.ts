import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Workload, WorkloadWeekType } from '../entities/workload.entity';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { ScheduleConflict, ConflictType, ConflictCategory } from '../entities/schedule-conflict.entity';
import { TeacherAvailability } from '../entities/teacher-availability.entity';
import { SanpinRulesService } from './sanpin-rules.service';

// Слот времени
interface TimeSlot {
    dayOfWeek: number;
    lessonNumber: number;
    weekType: WorkloadWeekType;
}

// Назначение урока
interface Assignment {
    workloadId: number;
    slot: TimeSlot;
    roomId: number | null;
}

// Опции солвера
interface SolverOptions {
    mode: 'full' | 'fill_gaps' | 'optimize';
    respectLocked: boolean;
    maxIterations: number;
    timeoutMs: number;
    priorities: {
        minimizeWindows: number;
        teacherPreferences: number;
        roomPreferences: number;
        evenDistribution: number;
    };
}

// Результат решения
export interface SolverResult {
    status: 'completed' | 'partial' | 'failed';
    assignments: Assignment[];
    unplacedWorkloads: number[];
    conflicts: Partial<ScheduleConflict>[];
    statistics: {
        totalWorkloads: number;
        placedWorkloads: number;
        hardViolations: number;
        softViolations: number;
        totalPenalty: number;
        executionTimeMs: number;
    };
}

@Injectable()
export class ScheduleSolverService {
    private readonly logger = new Logger(ScheduleSolverService.name);

    constructor(
        @InjectRepository(Workload)
        private workloadRepo: Repository<Workload>,
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(TeacherAvailability)
        private availabilityRepo: Repository<TeacherAvailability>,
        @InjectRepository(ScheduleConflict)
        private conflictRepo: Repository<ScheduleConflict>,
        private sanpinService: SanpinRulesService,
    ) {}

    /**
     * Основной метод автоматического составления расписания
     */
    async solve(versionId: number, options: SolverOptions): Promise<SolverResult> {
        const startTime = Date.now();
        this.logger.log(`Starting schedule solver for version ${versionId}, mode: ${options.mode}`);

        try {
            // 1. Загружаем данные
            const workloads = await this.loadWorkloads(versionId);
            const existingLessons = await this.loadExistingLessons(versionId, options.respectLocked);
            const teacherAvailability = await this.loadTeacherAvailability(workloads);

            // 2. Определяем нагрузки для размещения
            const workloadsToPlace = this.getWorkloadsToPlace(workloads, existingLessons, options.mode);

            if (workloadsToPlace.length === 0) {
                return {
                    status: 'completed',
                    assignments: [],
                    unplacedWorkloads: [],
                    conflicts: [],
                    statistics: {
                        totalWorkloads: workloads.length,
                        placedWorkloads: workloads.length,
                        hardViolations: 0,
                        softViolations: 0,
                        totalPenalty: 0,
                        executionTimeMs: Date.now() - startTime,
                    },
                };
            }

            // 3. Если режим full - очищаем незаблокированные уроки
            if (options.mode === 'full') {
                await this.clearUnlockedLessons(versionId);
            }

            // 4. Генерируем слоты
            const timeSlots = this.generateTimeSlots();

            // 5. Запускаем жадный алгоритм с backtracking
            const result = await this.greedySchedule(
                versionId,
                workloadsToPlace,
                timeSlots,
                existingLessons,
                teacherAvailability,
                options,
                startTime,
            );

            // 6. Анализируем конфликты
            await this.updateConflicts(versionId);

            return result;
        } catch (error) {
            this.logger.error(`Solver failed: ${error.message}`, error.stack);
            return {
                status: 'failed',
                assignments: [],
                unplacedWorkloads: [],
                conflicts: [],
                statistics: {
                    totalWorkloads: 0,
                    placedWorkloads: 0,
                    hardViolations: 0,
                    softViolations: 0,
                    totalPenalty: 0,
                    executionTimeMs: Date.now() - startTime,
                },
            };
        }
    }

    /**
     * Жадный алгоритм составления расписания
     */
    private async greedySchedule(
        versionId: number,
        workloads: Workload[],
        slots: TimeSlot[],
        existingLessons: ScheduleLesson[],
        availability: Map<number, TeacherAvailability[]>,
        options: SolverOptions,
        startTime: number,
    ): Promise<SolverResult> {
        const assignments: Assignment[] = [];
        const unplacedWorkloads: number[] = [];
        const occupiedSlots = new Map<string, ScheduleLesson>();

        // Индексируем существующие уроки
        for (const lesson of existingLessons) {
            const key = this.getSlotKey(lesson.dayOfWeek, lesson.lessonNumber, lesson.weekType);
            occupiedSlots.set(`${key}-t${lesson.workload.teacherId}`, lesson);
            occupiedSlots.set(`${key}-c${lesson.workload.classId}`, lesson);
            if (lesson.roomId) {
                occupiedSlots.set(`${key}-r${lesson.roomId}`, lesson);
            }
        }

        // Сортируем нагрузки по сложности (сначала сложные)
        const sortedWorkloads = this.sortWorkloadsByDifficulty(workloads);

        // Для каждой нагрузки пытаемся разместить все часы
        for (const workload of sortedWorkloads) {
            // Проверяем таймаут
            if (Date.now() - startTime > options.timeoutMs) {
                this.logger.warn('Solver timeout reached');
                break;
            }

            const hoursToPlace = this.getHoursToPlace(workload, existingLessons);

            for (let hour = 0; hour < hoursToPlace; hour++) {
                const bestSlot = this.findBestSlot(
                    workload,
                    slots,
                    occupiedSlots,
                    availability,
                    options.priorities,
                );

                if (bestSlot) {
                    // Размещаем урок
                    const lesson = await this.createLesson(versionId, workload, bestSlot);

                    // Обновляем занятые слоты
                    const key = this.getSlotKey(bestSlot.dayOfWeek, bestSlot.lessonNumber, bestSlot.weekType);
                    occupiedSlots.set(`${key}-t${workload.teacherId}`, lesson);
                    occupiedSlots.set(`${key}-c${workload.classId}`, lesson);
                    if (lesson.roomId) {
                        occupiedSlots.set(`${key}-r${lesson.roomId}`, lesson);
                    }

                    assignments.push({
                        workloadId: workload.id,
                        slot: bestSlot,
                        roomId: lesson.roomId,
                    });
                } else {
                    // Не удалось разместить
                    if (!unplacedWorkloads.includes(workload.id)) {
                        unplacedWorkloads.push(workload.id);
                    }
                }
            }
        }

        const totalWorkloads = workloads.reduce((sum, w) => sum + w.hoursPerWeek, 0);
        const placedCount = assignments.length;

        return {
            status: unplacedWorkloads.length === 0 ? 'completed' : 'partial',
            assignments,
            unplacedWorkloads,
            conflicts: [],
            statistics: {
                totalWorkloads,
                placedWorkloads: placedCount,
                hardViolations: 0,
                softViolations: 0,
                totalPenalty: 0,
                executionTimeMs: Date.now() - startTime,
            },
        };
    }

    /**
     * Найти лучший слот для нагрузки
     */
    private findBestSlot(
        workload: Workload,
        slots: TimeSlot[],
        occupiedSlots: Map<string, ScheduleLesson>,
        availability: Map<number, TeacherAvailability[]>,
        priorities: SolverOptions['priorities'],
    ): TimeSlot | null {
        let bestSlot: TimeSlot | null = null;
        let bestScore = -Infinity;

        for (const slot of slots) {
            // Проверяем hard constraints
            if (!this.canPlaceInSlot(workload, slot, occupiedSlots, availability)) {
                continue;
            }

            // Считаем score для soft constraints
            const score = this.calculateSlotScore(workload, slot, occupiedSlots, availability, priorities);

            if (score > bestScore) {
                bestScore = score;
                bestSlot = slot;
            }
        }

        return bestSlot;
    }

    /**
     * Проверка возможности размещения (hard constraints)
     */
    private canPlaceInSlot(
        workload: Workload,
        slot: TimeSlot,
        occupiedSlots: Map<string, ScheduleLesson>,
        availability: Map<number, TeacherAvailability[]>,
    ): boolean {
        const key = this.getSlotKey(slot.dayOfWeek, slot.lessonNumber, slot.weekType);

        // Учитель занят
        if (occupiedSlots.has(`${key}-t${workload.teacherId}`)) {
            return false;
        }

        // Класс занят
        if (occupiedSlots.has(`${key}-c${workload.classId}`)) {
            return false;
        }

        // Кабинет занят (если указан)
        if (workload.roomId && occupiedSlots.has(`${key}-r${workload.roomId}`)) {
            return false;
        }

        // Учитель недоступен
        const teacherAvail = availability.get(workload.teacherId);
        if (teacherAvail) {
            const slotAvail = teacherAvail.find(
                a => a.dayOfWeek === slot.dayOfWeek && a.lessonNumber === slot.lessonNumber
            );
            if (slotAvail && !slotAvail.isAvailable) {
                return false;
            }
        }

        return true;
    }

    /**
     * Расчёт оценки слота (soft constraints)
     */
    private calculateSlotScore(
        workload: Workload,
        slot: TimeSlot,
        occupiedSlots: Map<string, ScheduleLesson>,
        availability: Map<number, TeacherAvailability[]>,
        priorities: SolverOptions['priorities'],
    ): number {
        let score = 0;

        // Предпочтения учителя
        const teacherAvail = availability.get(workload.teacherId);
        if (teacherAvail) {
            const slotAvail = teacherAvail.find(
                a => a.dayOfWeek === slot.dayOfWeek && a.lessonNumber === slot.lessonNumber
            );
            if (slotAvail) {
                score += slotAvail.preference * priorities.teacherPreferences;
            }
        }

        // Сложные предметы лучше ставить на 2-4 уроки
        const difficulty = workload.difficulty || workload.subject?.difficulty || 5;
        if (difficulty >= 10) {
            if (slot.lessonNumber >= 2 && slot.lessonNumber <= 4) {
                score += 10;
            } else {
                score -= (difficulty - 9);
            }
        }

        // Штраф за окна (проверяем соседние уроки)
        const hasNeighbor = this.hasAdjacentLesson(workload.teacherId, slot, occupiedSlots);
        if (hasNeighbor) {
            score += priorities.minimizeWindows * 2;
        }

        // Равномерное распределение по дням
        const lessonsThisDay = this.countLessonsOnDay(workload.classId, slot.dayOfWeek, occupiedSlots);
        score -= lessonsThisDay * priorities.evenDistribution;

        return score;
    }

    /**
     * Проверка наличия соседнего урока (для минимизации окон)
     */
    private hasAdjacentLesson(
        teacherId: number,
        slot: TimeSlot,
        occupiedSlots: Map<string, ScheduleLesson>,
    ): boolean {
        const prevKey = this.getSlotKey(slot.dayOfWeek, slot.lessonNumber - 1, slot.weekType);
        const nextKey = this.getSlotKey(slot.dayOfWeek, slot.lessonNumber + 1, slot.weekType);

        return occupiedSlots.has(`${prevKey}-t${teacherId}`) ||
               occupiedSlots.has(`${nextKey}-t${teacherId}`);
    }

    /**
     * Подсчёт уроков класса в день
     */
    private countLessonsOnDay(
        classId: number,
        dayOfWeek: number,
        occupiedSlots: Map<string, ScheduleLesson>,
    ): number {
        let count = 0;
        for (const [key] of occupiedSlots) {
            if (key.includes(`-c${classId}`) && key.startsWith(`${dayOfWeek}-`)) {
                count++;
            }
        }
        return count;
    }

    // ==================== Вспомогательные методы ====================

    private async loadWorkloads(versionId: number): Promise<Workload[]> {
        return this.workloadRepo.find({
            where: { versionId },
            relations: ['schoolClass', 'teacher', 'subject', 'room', 'lessons'],
        });
    }

    private async loadExistingLessons(versionId: number, respectLocked: boolean): Promise<ScheduleLesson[]> {
        if (respectLocked) {
            return this.lessonRepo.find({
                where: { versionId, isLocked: true },
                relations: ['workload'],
            });
        }
        return this.lessonRepo.find({
            where: { versionId },
            relations: ['workload'],
        });
    }

    private async loadTeacherAvailability(workloads: Workload[]): Promise<Map<number, TeacherAvailability[]>> {
        const teacherIds = [...new Set(workloads.map(w => w.teacherId))];
        if (teacherIds.length === 0) return new Map();

        const availability = await this.availabilityRepo.find({
            where: { teacherId: In(teacherIds) },
        });

        const map = new Map<number, TeacherAvailability[]>();
        for (const avail of availability) {
            if (!map.has(avail.teacherId)) {
                map.set(avail.teacherId, []);
            }
            map.get(avail.teacherId)!.push(avail);
        }
        return map;
    }

    private getWorkloadsToPlace(
        workloads: Workload[],
        existingLessons: ScheduleLesson[],
        mode: string,
    ): Workload[] {
        if (mode === 'full') {
            return workloads;
        }

        return workloads.filter(w => {
            const placedCount = existingLessons.filter(l => l.workloadId === w.id).length;
            return placedCount < w.hoursPerWeek;
        });
    }

    private getHoursToPlace(workload: Workload, existingLessons: ScheduleLesson[]): number {
        const placedCount = existingLessons.filter(l => l.workloadId === workload.id).length;
        return Math.max(0, workload.hoursPerWeek - placedCount);
    }

    private generateTimeSlots(): TimeSlot[] {
        const slots: TimeSlot[] = [];
        for (let day = 1; day <= 5; day++) {
            for (let lesson = 1; lesson <= 7; lesson++) {
                slots.push({
                    dayOfWeek: day,
                    lessonNumber: lesson,
                    weekType: WorkloadWeekType.BOTH,
                });
            }
        }
        return slots;
    }

    private getSlotKey(dayOfWeek: number, lessonNumber: number, weekType: WorkloadWeekType): string {
        return `${dayOfWeek}-${lessonNumber}-${weekType}`;
    }

    private sortWorkloadsByDifficulty(workloads: Workload[]): Workload[] {
        return [...workloads].sort((a, b) => {
            const diffA = a.difficulty || a.subject?.difficulty || 5;
            const diffB = b.difficulty || b.subject?.difficulty || 5;
            return diffB - diffA; // Сложные первыми
        });
    }

    private async createLesson(versionId: number, workload: Workload, slot: TimeSlot): Promise<ScheduleLesson> {
        const lesson = this.lessonRepo.create({
            versionId,
            workloadId: workload.id,
            dayOfWeek: slot.dayOfWeek,
            lessonNumber: slot.lessonNumber,
            weekType: slot.weekType,
            roomId: workload.roomId,
            isLocked: false,
        });
        return this.lessonRepo.save(lesson);
    }

    private async clearUnlockedLessons(versionId: number): Promise<void> {
        await this.lessonRepo.delete({ versionId, isLocked: false });
    }

    private async updateConflicts(versionId: number): Promise<void> {
        // Очищаем старые конфликты
        await this.conflictRepo.delete({ versionId });

        // Загружаем все уроки
        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'workload.teacher', 'workload.schoolClass'],
        });

        // Проверяем конфликты
        const slotMap = new Map<string, ScheduleLesson[]>();
        for (const lesson of lessons) {
            const key = `${lesson.dayOfWeek}-${lesson.lessonNumber}`;
            if (!slotMap.has(key)) {
                slotMap.set(key, []);
            }
            slotMap.get(key)!.push(lesson);
        }

        for (const [, slotLessons] of slotMap) {
            // Проверяем конфликты учителей
            const teacherIds = slotLessons.map(l => l.workload.teacherId);
            const duplicateTeachers = teacherIds.filter((id, i) => teacherIds.indexOf(id) !== i);

            for (const teacherId of new Set(duplicateTeachers)) {
                const conflictingLessons = slotLessons.filter(l => l.workload.teacherId === teacherId);
                await this.conflictRepo.save({
                    versionId,
                    type: ConflictType.HARD,
                    category: ConflictCategory.TEACHER_CONFLICT,
                    description: `${conflictingLessons[0].workload.teacher?.shortName || 'Учитель'} ведёт несколько уроков одновременно`,
                    affectedLessons: conflictingLessons.map(l => l.id),
                    severity: 10,
                    dayOfWeek: slotLessons[0].dayOfWeek,
                    lessonNumber: slotLessons[0].lessonNumber,
                });
            }
        }
    }
}
