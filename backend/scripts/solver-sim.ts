/**
 * Симулятор автосоставления с проверкой СМЕН.
 * Запускает настоящий ScheduleSolverService на данных «Школа №1» (2 смены)
 * с in-memory репозиториями и аудирует результат посменно:
 *  - конфликты (учитель/класс/кабинет) считаются ВНУТРИ смены;
 *  - пересечения между сменами допустимы (разное реальное время) и
 *    отдельно подсчитываются как подтверждение работы смен.
 */
import { ScheduleSolverService } from '../src/modules/schedule/solver/schedule-solver.service';
import { SanpinRulesService, DEFAULT_SANPIN_RULES } from '../src/modules/schedule/solver/sanpin-rules.service';
import { buildDataset, datasetSummary } from './school1-dataset';

const ds = buildDataset();
console.log(datasetSummary(ds));
const s1 = ds.classes.filter((c) => c.shift === 1).length;
const s2 = ds.classes.filter((c) => c.shift === 2).length;
console.log(`Смены: 1 смена = ${s1} классов, 2 смена = ${s2} классов\n`);

const classById = new Map(ds.classes.map((c) => [c.id, c]));
const subjectById = new Map(ds.subjects.map((s) => [s.id, s]));
const teacherById = new Map(ds.teachers.map((t) => [t.id, t]));
const shiftOfClass = (classId: number) => classById.get(classId)!.shift || 1;

const solverWorkloads = ds.workloads.map((w) => {
    const c = classById.get(w.classId)!;
    const s = subjectById.get(w.subjectId)!;
    const t = teacherById.get(w.teacherId)!;
    return {
        id: w.id, classId: w.classId, groupId: null, subjectId: w.subjectId,
        teacherId: w.teacherId, roomId: null, hoursPerWeek: w.hoursPerWeek,
        weekType: 'both', difficulty: w.difficulty,
        additionalClassIds: [], additionalTeacherIds: [],
        schoolClass: { id: c.id, name: c.name, gradeLevel: c.gradeLevel, studentsCount: c.studentsCount, maxLessonsPerDay: null, shift: c.shift },
        subject: { id: s.id, name: s.name, difficulty: s.difficulty, sanpinCategory: s.sanpinCategory },
        teacher: { id: t.id, shortName: t.shortName, fullName: t.fullName },
        lessons: [],
    } as any;
});

const solverRooms = ds.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, type: r.type, isActive: true, schoolId: 1 }));
const version: any = { id: 1, schoolId: 1, workingDays: ds.version.workingDays, maxLessonsPerDay: ds.version.maxLessonsPerDay, weekType: ds.version.weekType, institutionType: 'school' };

async function runScenario(label: string, rooms: any[]) {
    const saved: any[] = [];
    let lessonSeq = 1;
    const mock = (impl: any) => impl;
    const workloadRepo = mock({ find: async () => solverWorkloads });
    const lessonRepo = mock({
        find: async () => [],
        create: (obj: any) => ({ ...obj }),
        save: async (obj: any) => { if (obj.id) { const i = saved.findIndex((x: any) => x.id === obj.id); if (i >= 0) { saved[i] = obj; return obj; } } const l = { ...obj, id: lessonSeq++ }; saved.push(l); return l; },
        delete: async () => ({ affected: 0 }),
    });
    const availabilityRepo = mock({ find: async () => [] });
    const conflictRepo = mock({ find: async () => [], delete: async () => ({}), save: async () => ({}) });
    const versionRepo = mock({ findOne: async () => version });
    const roomRepo = mock({ find: async () => rooms });

    const sanpin = new SanpinRulesService(null as any);
    const solver = new ScheduleSolverService(
        workloadRepo as any, lessonRepo as any, availabilityRepo as any,
        conflictRepo as any, versionRepo as any, roomRepo as any, sanpin as any,
    );
    (solver as any).logger = { log: () => {}, warn: () => {}, error: (m: string) => console.log('[err]', m) };

    const t0 = Date.now();
    const result = await solver.solve(1, {
        mode: 'full', respectLocked: false, maxIterations: 100000, timeoutMs: 60000,
        priorities: { minimizeWindows: 8, teacherPreferences: 5, roomPreferences: 3, evenDistribution: 7 },
    });

    const totalRequired = ds.workloads.reduce((s, w) => s + w.hoursPerWeek, 0);
    console.log(`\n========== СЦЕНАРИЙ: ${label} (кабинетов: ${rooms.length}) ==========`);
    console.log('Статус:', result.status,
        `| размещено ${result.statistics.placedWorkloads}/${totalRequired} (${(100 * result.statistics.placedWorkloads / totalRequired).toFixed(1)}%)`,
        `| ${Date.now() - t0} мс`);

    // ---- посменный аудит ----
    const wlById = new Map(ds.workloads.map((w) => [w.id, w]));
    const teacherSlot = new Map<string, number>();   // учитель|день-урок|смена
    const classSlot = new Map<string, number>();     // класс|день-урок
    const roomSlot = new Map<string, number>();      // кабинет|день-урок|смена
    const teacherShifts = new Map<string, Set<number>>(); // учитель|день-урок -> смены
    const roomShifts = new Map<string, Set<number>>();    // кабинет|день-урок -> смены
    const classDay = new Map<string, Set<number>>();
    let teacherClash = 0, classClash = 0, roomClash = 0, sanpinOver = 0, roomless = 0;
    const addTo = (m: Map<string, Set<number>>, k: string, v: number) => { const s = m.get(k); if (s) s.add(v); else m.set(k, new Set([v])); };

    for (const l of saved) {
        const w = wlById.get(l.workloadId)!;
        const sh = shiftOfClass(w.classId);
        const key = `${l.dayOfWeek}-${l.lessonNumber}`;
        const tk = `${w.teacherId}|${key}|${sh}`; teacherSlot.set(tk, (teacherSlot.get(tk) || 0) + 1); if ((teacherSlot.get(tk) || 0) > 1) teacherClash++;
        const ck = `${w.classId}|${key}`; classSlot.set(ck, (classSlot.get(ck) || 0) + 1); if ((classSlot.get(ck) || 0) > 1) classClash++;
        if (l.roomId) { const rk = `${l.roomId}|${key}|${sh}`; roomSlot.set(rk, (roomSlot.get(rk) || 0) + 1); if ((roomSlot.get(rk) || 0) > 1) roomClash++; addTo(roomShifts, `${l.roomId}|${key}`, sh); }
        else roomless++;
        addTo(teacherShifts, `${w.teacherId}|${key}`, sh);
        const cd = `${w.classId}-${l.dayOfWeek}`; if (!classDay.has(cd)) classDay.set(cd, new Set()); classDay.get(cd)!.add(l.lessonNumber);
    }
    for (const [cd, set] of classDay) {
        const grade = classById.get(Number(cd.split('-')[0]))!.gradeLevel;
        if (set.size > (DEFAULT_SANPIN_RULES.MAX_LESSONS_PER_DAY[grade] || 7)) sanpinOver++;
    }
    let teacherCross = 0; for (const set of teacherShifts.values()) if (set.size > 1) teacherCross++;
    let roomCross = 0; for (const set of roomShifts.values()) if (set.size > 1) roomCross++;

    console.log(`Аудит (внутри смены): накладки учитель=${teacherClash}, класс=${classClash}, кабинет=${roomClash}, СанПиН=${sanpinOver}, уроков БЕЗ кабинета=${roomless}`);
    console.log(`Пересечения между сменами (норма — разное время): учителей ${teacherCross}, кабинетов ${roomCross}`);

    // фиксация по сменам
    for (const sh of [1, 2]) {
        const req = ds.workloads.filter((w) => shiftOfClass(w.classId) === sh).reduce((s, w) => s + w.hoursPerWeek, 0);
        const pl = saved.filter((l) => shiftOfClass(wlById.get(l.workloadId)!.classId) === sh).length;
        if (req > 0) console.log(`  Смена ${sh}: размещено ${pl}/${req} (${(100 * pl / req).toFixed(1)}%)`);
    }

    if (result.unplacedDetails && result.unplacedDetails.length) {
        const byReason = new Map<string, number>();
        result.unplacedDetails.forEach((d) => { const r = d.reason.replace(/\s*\(.*/, ''); byReason.set(r, (byReason.get(r) || 0) + 1); });
        console.log('Причины неразмещения:', [...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}× ${r}`).join('; '));
    }

    const ok = result.status !== 'failed' && teacherClash === 0 && classClash === 0 && roomClash === 0 && sanpinOver === 0 && (rooms.length === 0 || roomless === 0);
    console.log('ИТОГ:', ok ? '✅ Посменных нарушений нет; смены корректно делят время.' : '❌ Проблемы (см. выше).');
}

(async () => {
    await runScenario('полный набор кабинетов', solverRooms);
    await runScenario('дефицит кабинетов', solverRooms.slice(0, 12));
})();
