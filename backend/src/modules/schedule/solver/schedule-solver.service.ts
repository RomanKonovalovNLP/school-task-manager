import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Workload, WorkloadWeekType } from '../entities/workload.entity';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { ScheduleConflict, ConflictType, ConflictCategory } from '../entities/schedule-conflict.entity';
import { TeacherAvailability } from '../entities/teacher-availability.entity';
import { ScheduleVersion } from '../entities/schedule-version.entity';
import { Room, RoomType } from '../entities/room.entity';
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
    warnings?: string[];
    unplacedDetails?: { workloadId: number; subject?: string; className?: string; reason: string }[];
    statistics: {
        totalWorkloads: number;
        placedWorkloads: number;
        hardViolations: number;
        softViolations: number;
        totalPenalty: number;
        executionTimeMs: number;
    };
}

/**
 * Контекст размещения: занятость + индексы (для скорости и мягких правил).
 */
interface SolveContext {
    // day-lesson -> список уроков в этом слоте (любая неделя)
    slotLessons: Map<string, ScheduleLesson[]>;
    // teacherId-day -> номера уроков (для окон учителя)
    teacherDayLessons: Map<string, Set<number>>;
    // classId-day -> номера уроков (периоды класса, параллельные группы = один период)
    classDayPeriods: Map<string, Set<number>>;
    // classId-day -> суммарная сложность (СанПиН)
    classDayDifficulty: Map<string, number>;
    // workloadId-day -> сколько уроков этой нагрузки в день
    workloadDayCount: Map<string, number>;
    // workloadId -> занятые дни (для распределения по неделе)
    workloadDays: Map<number, Set<number>>;
    // roomId-day-lesson -> занят (быстрый поиск свободного кабинета)
    rooms: Room[];
    workingDaysCount: number;
    institutionType: string;
    oddEven: boolean;
    priorities: SolverOptions['priorities'];
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
        @InjectRepository(ScheduleVersion)
        private versionRepo: Repository<ScheduleVersion>,
        @InjectRepository(Room)
        private roomRepo: Repository<Room>,
        private sanpinService: SanpinRulesService,
    ) {}

    /**
     * Основной метод автоматического составления расписания
     */
    async solve(versionId: number, options: SolverOptions): Promise<SolverResult> {
        const startTime = Date.now();
        this.logger.log(`Starting schedule solver for version ${versionId}, mode: ${options.mode}`);

        try {
            const version = await this.versionRepo.findOne({ where: { id: versionId } });
            const workingDays = version?.workingDays || 31; // 31 = Пн-Пт
            const maxLessons = version?.maxLessonsPerDay || 7;
            const institutionType = (version as any)?.institutionType || 'school';
            const oddEven = (version as any)?.weekType === 'odd_even';

            this.logger.log(`Version: workingDays=${workingDays}, maxLessons=${maxLessons}, type=${institutionType}, oddEven=${oddEven}`);

            const workloads = await this.loadWorkloads(versionId);
            const existingLessons = await this.loadExistingLessons(versionId, options.respectLocked);
            const teacherAvailability = await this.loadTeacherAvailability(workloads);
            const rooms = await this.loadRooms(version?.schoolId);

            const workloadsToPlace = this.getWorkloadsToPlace(workloads, existingLessons, options.mode);

            if (workloadsToPlace.length === 0) {
                return this.emptyResult(workloads.length, startTime);
            }

            if (options.mode === 'full') {
                await this.clearUnlockedLessons(versionId);
            }

            const timeSlots = this.generateTimeSlots(workingDays, maxLessons, oddEven);
            const workingDaysCount = new Set(timeSlots.map((s) => s.dayOfWeek)).size || 5;

            // Предпроверка: хватает ли места классам/учителям
            const warnings = this.validateFeasibility(workloads, workingDaysCount, maxLessons);

            const ctx: SolveContext = {
                slotLessons: new Map(),
                teacherDayLessons: new Map(),
                classDayPeriods: new Map(),
                classDayDifficulty: new Map(),
                workloadDayCount: new Map(),
                workloadDays: new Map(),
                rooms,
                workingDaysCount,
                institutionType,
                oddEven,
                priorities: options.priorities,
            };

            // Индексируем существующие (заблокированные) уроки
            for (const lesson of existingLessons) {
                if (lesson.workload) this.registerLesson(lesson, lesson.workload, ctx);
            }

            const result = await this.greedySchedule(
                versionId,
                workloadsToPlace,
                timeSlots,
                existingLessons,
                teacherAvailability,
                options,
                startTime,
                ctx,
            );

            // Второй проход: локальный поиск (одиночные перестановки) для остатков
            if (result.unplacedWorkloads.length > 0 && Date.now() - startTime < options.timeoutMs) {
                await this.localSearchImprove(versionId, workloadsToPlace, timeSlots, teacherAvailability, ctx, options, startTime, result);
            }

            result.warnings = warnings;
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

    private emptyResult(total: number, startTime: number): SolverResult {
        return {
            status: 'completed',
            assignments: [],
            unplacedWorkloads: [],
            conflicts: [],
            statistics: {
                totalWorkloads: total,
                placedWorkloads: total,
                hardViolations: 0,
                softViolations: 0,
                totalPenalty: 0,
                executionTimeMs: Date.now() - startTime,
            },
        };
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
        ctx: SolveContext,
    ): Promise<SolverResult> {
        const assignments: Assignment[] = [];
        const unplacedWorkloads: number[] = [];
        const unplacedDetails: SolverResult['unplacedDetails'] = [];

        const sortedWorkloads = this.sortWorkloadsByDifficulty(workloads);

        for (const workload of sortedWorkloads) {
            if (Date.now() - startTime > options.timeoutMs) {
                this.logger.warn('Solver timeout reached');
                break;
            }

            // Слоты, допустимые для типа недели этой нагрузки
            const allowedSlots = slots.filter((s) => this.slotAllowedForWorkload(s, workload, ctx));
            const hoursToPlace = this.getHoursToPlace(workload, existingLessons);

            for (let hour = 0; hour < hoursToPlace; hour++) {
                const bestSlot = this.findBestSlot(workload, allowedSlots, availability, ctx);

                if (bestSlot) {
                    const roomId = this.pickRoom(workload, bestSlot, ctx);
                    const lesson = await this.createLesson(versionId, workload, bestSlot, roomId);
                    (lesson as any).workload = workload; // для последующих проверок
                    this.registerLesson(lesson, workload, ctx);

                    assignments.push({ workloadId: workload.id, slot: bestSlot, roomId: lesson.roomId });
                } else {
                    if (!unplacedWorkloads.includes(workload.id)) {
                        unplacedWorkloads.push(workload.id);
                        unplacedDetails.push({
                            workloadId: workload.id,
                            subject: workload.subject?.name,
                            className: workload.schoolClass?.name,
                            reason: this.diagnoseUnplaced(workload, allowedSlots, availability, ctx),
                        });
                    }
                }
            }
        }

        const totalWorkloads = workloads.reduce((sum, w) => sum + w.hoursPerWeek, 0);

        return {
            status: unplacedWorkloads.length === 0 ? 'completed' : 'partial',
            assignments,
            unplacedWorkloads,
            unplacedDetails,
            conflicts: [],
            statistics: {
                totalWorkloads,
                placedWorkloads: assignments.length,
                hardViolations: 0,
                softViolations: 0,
                totalPenalty: 0,
                executionTimeMs: Date.now() - startTime,
            },
        };
    }

    /** Обновляет все индексы контекста при размещении урока. */
    private registerLesson(lesson: ScheduleLesson, workload: Workload, ctx: SolveContext): void {
        const dl = `${lesson.dayOfWeek}-${lesson.lessonNumber}`;
        if (!ctx.slotLessons.has(dl)) ctx.slotLessons.set(dl, []);
        ctx.slotLessons.get(dl)!.push(lesson);

        for (const t of this.involvedTeachers(workload)) {
            const tKey = `${t}-${lesson.dayOfWeek}`;
            if (!ctx.teacherDayLessons.has(tKey)) ctx.teacherDayLessons.set(tKey, new Set());
            ctx.teacherDayLessons.get(tKey)!.add(lesson.lessonNumber);
        }

        const diff = this.subjectDifficulty(workload);
        for (const c of this.involvedClasses(workload)) {
            const cKey = `${c.classId}-${lesson.dayOfWeek}`;
            if (!ctx.classDayPeriods.has(cKey)) ctx.classDayPeriods.set(cKey, new Set());
            ctx.classDayPeriods.get(cKey)!.add(lesson.lessonNumber);
            ctx.classDayDifficulty.set(cKey, (ctx.classDayDifficulty.get(cKey) || 0) + diff);
        }

        const wKey = `${workload.id}-${lesson.dayOfWeek}`;
        ctx.workloadDayCount.set(wKey, (ctx.workloadDayCount.get(wKey) || 0) + 1);

        if (!ctx.workloadDays.has(workload.id)) ctx.workloadDays.set(workload.id, new Set());
        ctx.workloadDays.get(workload.id)!.add(lesson.dayOfWeek);
    }

    /** Снять урок со всех индексов контекста (обратное registerLesson). */
    private unregisterLesson(lesson: ScheduleLesson, workload: Workload, ctx: SolveContext): void {
        const dl = `${lesson.dayOfWeek}-${lesson.lessonNumber}`;
        const arr = ctx.slotLessons.get(dl);
        if (arr) { const i = arr.findIndex((l) => l === lesson || l.id === lesson.id); if (i >= 0) arr.splice(i, 1); }
        for (const t of this.involvedTeachers(workload)) {
            const set = ctx.teacherDayLessons.get(`${t}-${lesson.dayOfWeek}`);
            if (set) set.delete(lesson.lessonNumber);
        }
        const diff = this.subjectDifficulty(workload);
        for (const c of this.involvedClasses(workload)) {
            const cKey = `${c.classId}-${lesson.dayOfWeek}`;
            const set = ctx.classDayPeriods.get(cKey);
            if (set) {
                const stillUsed = (ctx.slotLessons.get(dl) || []).some((l) => l.workload && this.involvedClasses(l.workload).some((cc) => cc.classId === c.classId));
                if (!stillUsed) set.delete(lesson.lessonNumber);
            }
            ctx.classDayDifficulty.set(cKey, Math.max(0, (ctx.classDayDifficulty.get(cKey) || 0) - diff));
        }
        const wKey = `${workload.id}-${lesson.dayOfWeek}`;
        ctx.workloadDayCount.set(wKey, Math.max(0, (ctx.workloadDayCount.get(wKey) || 0) - 1));
        if ((ctx.workloadDayCount.get(wKey) || 0) === 0) {
            const days = ctx.workloadDays.get(workload.id);
            if (days) days.delete(lesson.dayOfWeek);
        }
    }

    /** Пересекаются ли две нагрузки по учителю/классу/закреплённому кабинету (с учётом смены). */
    private conflictsWith(a: Workload, b: Workload): boolean {
        if (!this.sameShift(a, b)) return false;
        const at = this.involvedTeachers(a), bt = this.involvedTeachers(b);
        if (at.some((t) => bt.includes(t))) return true;
        const ac = this.involvedClasses(a), bc = this.involvedClasses(b);
        for (const mc of ac) for (const lc of bc) {
            if (mc.classId !== lc.classId) continue;
            const lg = lc.groupId || 0, wg = mc.groupId || 0;
            if (lg === 0 || wg === 0 || lg === wg) return true;
        }
        if (a.roomId && a.roomId === b.roomId) return true;
        return false;
    }

    private async placeAndRegister(versionId: number, workload: Workload, slot: TimeSlot, ctx: SolveContext): Promise<void> {
        const roomId = this.pickRoom(workload, slot, ctx);
        const lesson = await this.createLesson(versionId, workload, slot, roomId);
        (lesson as any).workload = workload;
        this.registerLesson(lesson, workload, ctx);
    }

    private countPlaced(ctx: SolveContext): number {
        let n = 0;
        for (const arr of ctx.slotLessons.values()) n += arr.length;
        return n;
    }

    /** Попытка разместить один час нагрузки через одиночную перестановку блокирующего урока. */
    private async tryPlaceWithOneMove(
        versionId: number, W: Workload, allSlots: TimeSlot[],
        availability: Map<number, TeacherAvailability[]>, ctx: SolveContext,
    ): Promise<boolean> {
        const wSlots = allSlots.filter((s) => this.slotAllowedForWorkload(s, W, ctx));
        for (const S of wSlots) {
            const dl = `${S.dayOfWeek}-${S.lessonNumber}`;
            const inSlot = (ctx.slotLessons.get(dl) || []).filter((l) => this.weekTypesOverlap(l.weekType, S.weekType));
            const blockers = inSlot.filter((l) => l.workload && this.conflictsWith(W, l.workload));

            if (blockers.length === 0) {
                if (this.canPlaceInSlot(W, S, availability, ctx)) { await this.placeAndRegister(versionId, W, S, ctx); return true; }
                continue;
            }
            if (blockers.length !== 1) continue;
            const bl = blockers[0];
            if (bl.isLocked || !bl.workload) continue;
            const blw = bl.workload;

            this.unregisterLesson(bl, blw, ctx);
            if (!this.canPlaceInSlot(W, S, availability, ctx)) { this.registerLesson(bl, blw, ctx); continue; }

            const blSlots = allSlots.filter((s) => this.slotAllowedForWorkload(s, blw, ctx));
            let moved: TimeSlot | null = null;
            for (const S2 of blSlots) {
                if (S2.dayOfWeek === bl.dayOfWeek && S2.lessonNumber === bl.lessonNumber && S2.weekType === bl.weekType) continue;
                // не переносим блокирующий урок в тот самый слот, который освобождаем под W
                if (S2.dayOfWeek === S.dayOfWeek && S2.lessonNumber === S.lessonNumber) continue;
                if (this.canPlaceInSlot(blw, S2, availability, ctx)) { moved = S2; break; }
            }
            if (!moved) { this.registerLesson(bl, blw, ctx); continue; }

            // Применяем: переносим блокирующий урок и ставим наш
            bl.dayOfWeek = moved.dayOfWeek; bl.lessonNumber = moved.lessonNumber; bl.weekType = moved.weekType;
            const newRoom = this.pickRoom(blw, moved, ctx);
            if (newRoom != null) bl.roomId = newRoom;
            this.registerLesson(bl, blw, ctx);
            await this.lessonRepo.save(bl);
            await this.placeAndRegister(versionId, W, S, ctx);
            return true;
        }
        return false;
    }

    /** Второй проход: пытаемся доразместить остатки перестановками (монотонно, без новых конфликтов). */
    private async localSearchImprove(
        versionId: number, workloads: Workload[], slots: TimeSlot[],
        availability: Map<number, TeacherAvailability[]>, ctx: SolveContext,
        options: SolverOptions, startTime: number, result: SolverResult,
    ): Promise<void> {
        const byId = new Map(workloads.map((w) => [w.id, w]));
        const placedCount = (wid: number) => {
            let n = 0; for (const arr of ctx.slotLessons.values()) for (const l of arr) if (l.workloadId === wid) n++; return n;
        };
        const stillUnplaced: number[] = [];
        for (const wid of result.unplacedWorkloads) {
            const W = byId.get(wid);
            if (!W) { stillUnplaced.push(wid); continue; }
            let missing = W.hoursPerWeek - placedCount(wid);
            while (missing > 0 && Date.now() - startTime < options.timeoutMs) {
                const ok = await this.tryPlaceWithOneMove(versionId, W, slots, availability, ctx);
                if (!ok) break;
                missing--;
            }
            if (missing > 0) stillUnplaced.push(wid);
        }
        result.unplacedWorkloads = stillUnplaced;
        result.unplacedDetails = (result.unplacedDetails || []).filter((d) => stillUnplaced.includes(d.workloadId));
        result.statistics.placedWorkloads = this.countPlaced(ctx);
        result.status = stillUnplaced.length === 0 ? 'completed' : 'partial';
    }

    /** Совместимы ли типы недель (BOTH пересекается со всеми). */
    private weekTypesOverlap(a: WorkloadWeekType, b: WorkloadWeekType): boolean {
        if (a === WorkloadWeekType.BOTH || b === WorkloadWeekType.BOTH) return true;
        return a === b;
    }

    private slotAllowedForWorkload(slot: TimeSlot, workload: Workload, ctx: SolveContext): boolean {
        if (!ctx.oddEven) return true; // одна неделя — все слоты BOTH
        const wt = workload.weekType || WorkloadWeekType.BOTH;
        return slot.weekType === wt;
    }

    /**
     * Найти лучший слот для нагрузки
     */
    private findBestSlot(
        workload: Workload,
        slots: TimeSlot[],
        availability: Map<number, TeacherAvailability[]>,
        ctx: SolveContext,
    ): TimeSlot | null {
        let bestSlot: TimeSlot | null = null;
        let bestScore = -Infinity;

        for (const slot of slots) {
            if (!this.canPlaceInSlot(workload, slot, availability, ctx)) continue;
            const score = this.calculateSlotScore(workload, slot, availability, ctx);
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
        availability: Map<number, TeacherAvailability[]>,
        ctx: SolveContext,
    ): boolean {
        const dl = `${slot.dayOfWeek}-${slot.lessonNumber}`;
        const inSlot = ctx.slotLessons.get(dl) || [];

        const myTeachers = this.involvedTeachers(workload);
        const myClasses = this.involvedClasses(workload);

        for (const l of inSlot) {
            if (!this.weekTypesOverlap(l.weekType, slot.weekType)) continue;
            const lw = l.workload;
            if (!lw) continue;
            // Разные смены = разное время, не конфликтуют
            if (!this.sameShift(lw, workload)) continue;
            // Учителя (основной + доп. для совместного преподавания)
            const lTeachers = this.involvedTeachers(lw);
            if (myTeachers.some((t) => lTeachers.includes(t))) return false;
            // Классы (основной + доп. для объединённых уроков/потоков), с учётом подгрупп
            const lClasses = this.involvedClasses(lw);
            for (const mc of myClasses) {
                for (const lc of lClasses) {
                    if (mc.classId !== lc.classId) continue;
                    const lg = lc.groupId || 0;
                    const wg = mc.groupId || 0;
                    if (lg === 0 || wg === 0 || lg === wg) return false;
                }
            }
            // Кабинет
            if (workload.roomId && l.roomId === workload.roomId) return false;
        }

        // Учитель недоступен по сетке предпочтений
        const teacherAvail = availability.get(workload.teacherId);
        if (teacherAvail) {
            const a = teacherAvail.find((x) => x.dayOfWeek === slot.dayOfWeek && x.lessonNumber === slot.lessonNumber);
            if (a && !a.isAvailable) return false;
        }

        // СанПиН: максимум уроков в день для класса
        const periods = ctx.classDayPeriods.get(`${workload.classId}-${slot.dayOfWeek}`) || new Set<number>();
        if (!periods.has(slot.lessonNumber) && periods.size >= this.getClassMaxLessonsPerDay(workload)) {
            return false;
        }

        // Контроль сдвоенных уроков (пар)
        const sameToday = ctx.workloadDayCount.get(`${workload.id}-${slot.dayOfWeek}`) || 0;
        if (sameToday >= this.getMaxSameWorkloadPerDay(workload, ctx)) {
            return false;
        }

        // Кабинет: если кабинеты заведены и у нагрузки нет закреплённого —
        // должен быть хотя бы один свободный. Иначе урок в этот слот не ставим.
        if (!workload.roomId && ctx.rooms && ctx.rooms.length > 0) {
            if (this.pickRoom(workload, slot, ctx) === null) return false;
        }

        return true;
    }

    private allowPairs(workload: Workload, ctx: SolveContext): boolean {
        // Пары разрешены явно для нагрузки ИЛИ по умолчанию для колледжа/вуза
        return !!(workload as any).allowDoubleLessons || ctx.institutionType !== 'school';
    }

    private getMaxSameWorkloadPerDay(workload: Workload, ctx: SolveContext): number {
        const unavoidable = Math.max(1, Math.ceil(workload.hoursPerWeek / Math.max(1, ctx.workingDaysCount)));
        return this.allowPairs(workload, ctx) ? Math.max(2, unavoidable) : unavoidable;
    }

    private getClassMaxLessonsPerDay(workload: Workload): number {
        const override = (workload.schoolClass as any)?.maxLessonsPerDay;
        if (override && override > 0) return override;
        const gradeLevel = workload.schoolClass?.gradeLevel;
        if (gradeLevel) return this.sanpinService.getMaxLessonsPerDay(gradeLevel);
        return 8;
    }

    private subjectDifficulty(workload: Workload): number {
        return workload.difficulty || workload.subject?.difficulty || 5;
    }

    /** Смена класса нагрузки (по умолчанию 1). Разные смены идут в разное время. */
    private shiftOf(w?: Workload): number {
        return ((w?.schoolClass as any)?.shift) || 1;
    }

    private sameShift(a?: Workload, b?: Workload): boolean {
        return this.shiftOf(a) === this.shiftOf(b);
    }

    /** Все учителя нагрузки: основной + дополнительные (совместное преподавание). */
    private involvedTeachers(w?: Workload): number[] {
        if (!w) return [];
        const extra = ((w as any).additionalTeacherIds || []) as (number | string)[];
        return [w.teacherId, ...extra.map((x) => Number(x))];
    }

    /** Все классы нагрузки: основной + дополнительные (объединённый урок/поток). */
    private involvedClasses(w?: Workload): Array<{ classId: number; groupId: number }> {
        if (!w) return [];
        const extra = ((w as any).additionalClassIds || []) as (number | string)[];
        return [{ classId: w.classId, groupId: w.groupId || 0 }, ...extra.map((id) => ({ classId: Number(id), groupId: 0 }))];
    }

    /**
     * Расчёт оценки слота (soft constraints)
     */
    private calculateSlotScore(
        workload: Workload,
        slot: TimeSlot,
        availability: Map<number, TeacherAvailability[]>,
        ctx: SolveContext,
    ): number {
        let score = 0;
        const p = ctx.priorities;

        // 1. Предпочтения учителя
        const teacherAvail = availability.get(workload.teacherId);
        if (teacherAvail) {
            const a = teacherAvail.find((x) => x.dayOfWeek === slot.dayOfWeek && x.lessonNumber === slot.lessonNumber);
            if (a) score += a.preference * p.teacherPreferences;
        }

        // 2. Сложные предметы — на 2-4 уроки и в продуктивные дни (Вт-Чт)
        const difficulty = this.subjectDifficulty(workload);
        if (difficulty >= 10) {
            score += (slot.lessonNumber >= 2 && slot.lessonNumber <= 4) ? 10 : -(difficulty - 9);
            if (slot.dayOfWeek >= 2 && slot.dayOfWeek <= 4) score += 3;
        }

        // 3. Минимизация окон УЧИТЕЛЯ
        const tDay = ctx.teacherDayLessons.get(`${workload.teacherId}-${slot.dayOfWeek}`);
        if (tDay && (tDay.has(slot.lessonNumber - 1) || tDay.has(slot.lessonNumber + 1))) {
            score += p.minimizeWindows * 2;
        }

        // 4. Окна КЛАССА: наказываем разрывы в дне класса, поощряем ранний старт
        const cKey = `${workload.classId}-${slot.dayOfWeek}`;
        const classPeriods = ctx.classDayPeriods.get(cKey);
        if (classPeriods && classPeriods.size > 0) {
            const withNew = new Set(classPeriods);
            withNew.add(slot.lessonNumber);
            const arr = [...withNew];
            const holes = (Math.max(...arr) - Math.min(...arr) + 1) - withNew.size;
            score -= holes * 25; // сильный штраф за окна у класса
        } else {
            score -= (slot.lessonNumber - 1) * 3; // первый урок дня — ближе к началу
        }

        // 5. Равномерное распределение по дням (класс)
        const lessonsThisDay = classPeriods ? classPeriods.size : 0;
        score -= lessonsThisDay * p.evenDistribution;

        // 6. СанПиН: дневная сложность класса
        const gradeLevel = workload.schoolClass?.gradeLevel;
        if (gradeLevel) {
            const cur = ctx.classDayDifficulty.get(cKey) || 0;
            const prospective = cur + difficulty;
            const maxDaily = this.sanpinService.getMaxDailyDifficulty(gradeLevel);
            if (prospective > maxDaily) score -= (prospective - maxDaily) * 2;
        }

        // 7. Контроль пар
        const adjacentSame = this.hasAdjacentSameWorkload(workload.id, slot, ctx);
        if (this.allowPairs(workload, ctx)) {
            if (adjacentSame) score += 30; // формируем настоящую пару
        } else {
            if (adjacentSame) score -= 50;
            const sameToday = ctx.workloadDayCount.get(`${workload.id}-${slot.dayOfWeek}`) || 0;
            if (sameToday >= 1) score -= p.evenDistribution;
        }

        // 8. Распределение предмета по неделе: дальше от уже занятых дней — лучше
        const usedDays = ctx.workloadDays.get(workload.id);
        if (usedDays && usedDays.size > 0) {
            let minDist = 7;
            for (const d of usedDays) minDist = Math.min(minDist, Math.abs(d - slot.dayOfWeek));
            if (minDist > 0) score += minDist * 2;
        }

        return score;
    }

    /** Есть ли соседний урок той же нагрузки в этот день (образуется пара). */
    private hasAdjacentSameWorkload(workloadId: number, slot: TimeSlot, ctx: SolveContext): boolean {
        for (const dl of [`${slot.dayOfWeek}-${slot.lessonNumber - 1}`, `${slot.dayOfWeek}-${slot.lessonNumber + 1}`]) {
            const lessons = ctx.slotLessons.get(dl);
            if (lessons && lessons.some((l) => l.workloadId === workloadId)) return true;
        }
        return false;
    }

    /**
     * Подбор кабинета: если у нагрузки задан кабинет — он (уже проверен на занятость).
     * Иначе выбираем свободный из пула по типу предмета и вместимости.
     */
    private pickRoom(workload: Workload, slot: TimeSlot, ctx: SolveContext): number | null {
        if (workload.roomId) return workload.roomId;
        if (!ctx.rooms || ctx.rooms.length === 0) return null;

        const dl = `${slot.dayOfWeek}-${slot.lessonNumber}`;
        const inSlot = ctx.slotLessons.get(dl) || [];
        const busyRoomIds = new Set(
            inSlot
                .filter((l) => this.weekTypesOverlap(l.weekType, slot.weekType) && l.roomId && this.sameShift(l.workload, workload))
                .map((l) => l.roomId),
        );

        const students = (workload.schoolClass as any)?.studentsCount || 0;
        const preferred = this.preferredRoomType(workload);

        const free = ctx.rooms.filter((r) => (r as any).isActive !== false && !busyRoomIds.has(r.id));
        if (free.length === 0) return null;

        // Сначала кабинеты нужного типа, затем обычные достаточной вместимости
        const byType = preferred ? free.filter((r) => r.type === preferred) : [];
        const pool = byType.length > 0 ? byType : free;

        const fitting = pool.filter((r) => (r.capacity || 0) >= students).sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
        if (fitting.length > 0) return fitting[0].id;

        // Нет достаточно большого — берём самый большой
        const largest = [...pool].sort((a, b) => (b.capacity || 0) - (a.capacity || 0))[0];
        return largest ? largest.id : null;
    }

    private preferredRoomType(workload: Workload): RoomType | null {
        const cat = String(workload.subject?.sanpinCategory || '');
        switch (cat) {
            case 'информатика': return RoomType.COMPUTER;
            case 'физкультура': return RoomType.GYM;
            case 'химия':
            case 'физика':
            case 'биология': return RoomType.LABORATORY;
            case 'музыка': return RoomType.MUSIC;
            case 'изо': return RoomType.ART;
            case 'технология': return RoomType.WORKSHOP;
            default: return null;
        }
    }

    /**
     * Диагностика: почему нагрузку не удалось разместить.
     */
    private diagnoseUnplaced(
        workload: Workload,
        slots: TimeSlot[],
        availability: Map<number, TeacherAvailability[]>,
        ctx: SolveContext,
    ): string {
        let teacherBusy = 0, classBusy = 0, classFull = 0, teacherUnavail = 0, pairLimit = 0, roomFull = 0, total = 0;
        const teacherAvail = availability.get(workload.teacherId);

        for (const slot of slots) {
            total++;
            const dl = `${slot.dayOfWeek}-${slot.lessonNumber}`;
            const inSlot = ctx.slotLessons.get(dl) || [];
            let tb = false, cb = false;
            for (const l of inSlot) {
                if (!this.weekTypesOverlap(l.weekType, slot.weekType) || !l.workload) continue;
                if (l.workload.teacherId === workload.teacherId && this.sameShift(l.workload, workload)) tb = true;
                if (l.workload.classId === workload.classId) {
                    const lg = l.workload.groupId || 0, wg = workload.groupId || 0;
                    if (lg === 0 || wg === 0 || lg === wg) cb = true;
                }
            }
            if (tb) { teacherBusy++; continue; }
            if (cb) { classBusy++; continue; }
            if (teacherAvail) {
                const a = teacherAvail.find((x) => x.dayOfWeek === slot.dayOfWeek && x.lessonNumber === slot.lessonNumber);
                if (a && !a.isAvailable) { teacherUnavail++; continue; }
            }
            const periods = ctx.classDayPeriods.get(`${workload.classId}-${slot.dayOfWeek}`) || new Set<number>();
            if (!periods.has(slot.lessonNumber) && periods.size >= this.getClassMaxLessonsPerDay(workload)) { classFull++; continue; }
            const st = ctx.workloadDayCount.get(`${workload.id}-${slot.dayOfWeek}`) || 0;
            if (st >= this.getMaxSameWorkloadPerDay(workload, ctx)) { pairLimit++; continue; }
            if (!workload.roomId && ctx.rooms && ctx.rooms.length > 0 && this.pickRoom(workload, slot, ctx) === null) { roomFull++; continue; }
        }

        const reasons = [
            { n: teacherBusy, msg: 'учитель занят в других классах' },
            { n: classBusy, msg: 'у класса уже стоят уроки в этих слотах' },
            { n: classFull, msg: 'достигнут дневной лимит уроков класса (СанПиН)' },
            { n: teacherUnavail, msg: 'учитель недоступен по своим предпочтениям' },
            { n: pairLimit, msg: 'ограничение на повтор предмета в день' },
            { n: roomFull, msg: 'нет свободных кабинетов в этих слотах' },
        ].sort((a, b) => b.n - a.n);

        const top = reasons[0];
        if (!top || top.n === 0) return 'нет свободных слотов';
        return `${top.msg} (заблокировано ~${top.n} из ${total} слотов)`;
    }

    /**
     * Предпроверка выполнимости: хватает ли места классам и учителям.
     */
    private validateFeasibility(workloads: Workload[], workingDaysCount: number, maxLessons: number): string[] {
        const warnings: string[] = [];

        // По классам
        const byClass = new Map<number, Workload[]>();
        for (const w of workloads) {
            if (!byClass.has(w.classId)) byClass.set(w.classId, []);
            byClass.get(w.classId)!.push(w);
        }
        for (const [, list] of byClass) {
            const cls = list[0].schoolClass;
            const whole = list.filter((w) => !w.groupId).reduce((s, w) => s + w.hoursPerWeek, 0);
            // Для делений на подгруппы: параллельные группы одного предмета = один период
            const groupedBySubject = new Map<number, number>();
            for (const w of list.filter((x) => x.groupId)) {
                groupedBySubject.set(w.subjectId, Math.max(groupedBySubject.get(w.subjectId) || 0, w.hoursPerWeek));
            }
            let grouped = 0;
            for (const [, h] of groupedBySubject) grouped += h;
            const needed = whole + grouped;
            const maxPerDay = (cls as any)?.maxLessonsPerDay || (cls?.gradeLevel ? this.sanpinService.getMaxLessonsPerDay(cls.gradeLevel) : maxLessons);
            const capacity = workingDaysCount * Math.min(maxLessons, maxPerDay);
            if (needed > capacity) {
                warnings.push(`Класс ${cls?.name || list[0].classId}: требуется ${needed} уроков/нед, а помещается ~${capacity}. Часть не разместится.`);
            }
        }

        // По учителям
        const byTeacher = new Map<number, { name?: string; hours: number }>();
        for (const w of workloads) {
            const rec = byTeacher.get(w.teacherId) || { name: w.teacher?.shortName || w.teacher?.fullName, hours: 0 };
            rec.hours += w.hoursPerWeek;
            byTeacher.set(w.teacherId, rec);
        }
        const teacherCap = workingDaysCount * maxLessons;
        for (const [, rec] of byTeacher) {
            if (rec.hours > teacherCap) {
                warnings.push(`Преподаватель ${rec.name || ''}: ${rec.hours} ч/нед превышает возможные ${teacherCap}.`);
            }
        }

        return warnings;
    }

    // ==================== Загрузка данных ====================

    private async loadWorkloads(versionId: number): Promise<Workload[]> {
        return this.workloadRepo.find({
            where: { versionId },
            relations: ['schoolClass', 'teacher', 'subject', 'room', 'lessons'],
        });
    }

    private async loadExistingLessons(versionId: number, respectLocked: boolean): Promise<ScheduleLesson[]> {
        const where: any = respectLocked ? { versionId, isLocked: true } : { versionId };
        return this.lessonRepo.find({
            where,
            relations: ['workload', 'workload.subject', 'workload.schoolClass'],
        });
    }

    private async loadRooms(schoolId?: number): Promise<Room[]> {
        try {
            return schoolId
                ? this.roomRepo.find({ where: { schoolId } as any })
                : this.roomRepo.find();
        } catch {
            return [];
        }
    }

    private async loadTeacherAvailability(workloads: Workload[]): Promise<Map<number, TeacherAvailability[]>> {
        const teacherIds = [...new Set(workloads.map((w) => w.teacherId))];
        if (teacherIds.length === 0) return new Map();

        const availability = await this.availabilityRepo.find({ where: { teacherId: In(teacherIds) } });
        const map = new Map<number, TeacherAvailability[]>();
        for (const a of availability) {
            if (!map.has(a.teacherId)) map.set(a.teacherId, []);
            map.get(a.teacherId)!.push(a);
        }
        return map;
    }

    private getWorkloadsToPlace(workloads: Workload[], existingLessons: ScheduleLesson[], mode: string): Workload[] {
        if (mode === 'full') return workloads;
        return workloads.filter((w) => existingLessons.filter((l) => l.workloadId === w.id).length < w.hoursPerWeek);
    }

    private getHoursToPlace(workload: Workload, existingLessons: ScheduleLesson[]): number {
        const placed = existingLessons.filter((l) => l.workloadId === workload.id).length;
        return Math.max(0, workload.hoursPerWeek - placed);
    }

    /**
     * Генерация временных слотов.
     * @param workingDays битовая маска (1=Пн ... 64=Вс)
     * @param maxLessons макс. уроков/пар в день
     * @param oddEven двухнедельное расписание (чёт/нечёт)
     */
    private generateTimeSlots(workingDays: number, maxLessons: number, oddEven: boolean): TimeSlot[] {
        const slots: TimeSlot[] = [];
        const weekTypes = oddEven
            ? [WorkloadWeekType.BOTH, WorkloadWeekType.ODD, WorkloadWeekType.EVEN]
            : [WorkloadWeekType.BOTH];

        for (let day = 1; day <= 7; day++) {
            if (!(workingDays & (1 << (day - 1)))) continue;
            for (let lesson = 1; lesson <= maxLessons; lesson++) {
                for (const wt of weekTypes) {
                    slots.push({ dayOfWeek: day, lessonNumber: lesson, weekType: wt });
                }
            }
        }
        this.logger.log(`Generated ${slots.length} slots (days mask ${workingDays}, maxLessons ${maxLessons}, oddEven ${oddEven})`);
        return slots;
    }

    private sortWorkloadsByDifficulty(workloads: Workload[]): Workload[] {
        return [...workloads].sort((a, b) => this.subjectDifficulty(b) - this.subjectDifficulty(a));
    }

    private async createLesson(versionId: number, workload: Workload, slot: TimeSlot, roomId: number | null): Promise<ScheduleLesson> {
        const lesson = this.lessonRepo.create({
            versionId,
            workloadId: workload.id,
            dayOfWeek: slot.dayOfWeek,
            lessonNumber: slot.lessonNumber,
            weekType: slot.weekType,
            roomId: roomId ?? workload.roomId ?? null,
            isLocked: false,
        });
        return this.lessonRepo.save(lesson);
    }

    private async clearUnlockedLessons(versionId: number): Promise<void> {
        await this.lessonRepo.delete({ versionId, isLocked: false });
    }

    private async updateConflicts(versionId: number): Promise<void> {
        await this.conflictRepo.delete({ versionId });

        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'workload.teacher', 'workload.schoolClass'],
        });

        // Группируем по слоту (день-урок), проверяем пересечение недель
        const byDayLesson = new Map<string, ScheduleLesson[]>();
        for (const lesson of lessons) {
            const key = `${lesson.dayOfWeek}-${lesson.lessonNumber}`;
            if (!byDayLesson.has(key)) byDayLesson.set(key, []);
            byDayLesson.get(key)!.push(lesson);
        }

        for (const [, group] of byDayLesson) {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const a = group[i], b = group[j];
                    if (!this.weekTypesOverlap(a.weekType, b.weekType)) continue;
                    if (a.workload?.teacherId && a.workload.teacherId === b.workload?.teacherId && this.sameShift(a.workload, b.workload)) {
                        await this.conflictRepo.save({
                            versionId,
                            type: ConflictType.HARD,
                            category: ConflictCategory.TEACHER_CONFLICT,
                            description: `${a.workload.teacher?.shortName || 'Учитель'} ведёт несколько уроков одновременно`,
                            affectedLessons: [a.id, b.id],
                            severity: 10,
                            dayOfWeek: a.dayOfWeek,
                            lessonNumber: a.lessonNumber,
                        });
                    }
                }
            }
        }
    }
}
