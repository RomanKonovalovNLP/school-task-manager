/**
 * Проверка ДВУХНЕДЕЛЬНОГО режима (чёт/нечёт).
 * Версия weekType='odd_even'; часть предметов (1 ч/нед) чередуется по неделям
 * (odd/even), остальные — 'both'. Конфликты аудируются с учётом пересечения
 * недель: odd и even в одном слоте НЕ конфликтуют (разные недели), both — со всеми.
 */
import { ScheduleSolverService } from '../src/modules/schedule/solver/schedule-solver.service';
import { SanpinRulesService, DEFAULT_SANPIN_RULES } from '../src/modules/schedule/solver/sanpin-rules.service';
import { buildDataset, datasetSummary } from './school1-dataset';

const ds = buildDataset();
console.log(datasetSummary(ds));

const classById = new Map(ds.classes.map((c) => [c.id, c]));
const subjectById = new Map(ds.subjects.map((s) => [s.id, s]));
const teacherById = new Map(ds.teachers.map((t) => [t.id, t]));

// Назначаем тип недели: 1-часовые предметы чередуем odd/even, остальные both
let oneHourIdx = 0;
const weekTypeByWl = new Map<number, 'both' | 'odd' | 'even'>();
for (const w of ds.workloads) {
    if (w.hoursPerWeek === 1) weekTypeByWl.set(w.id, (oneHourIdx++ % 2 === 0) ? 'odd' : 'even');
    else weekTypeByWl.set(w.id, 'both');
}
const cntBoth = [...weekTypeByWl.values()].filter((v) => v === 'both').length;
const cntOdd = [...weekTypeByWl.values()].filter((v) => v === 'odd').length;
const cntEven = [...weekTypeByWl.values()].filter((v) => v === 'even').length;
console.log(`Режим: ДВУХНЕДЕЛЬНЫЙ (odd_even). Нагрузок: both=${cntBoth}, odd=${cntOdd}, even=${cntEven}\n`);

// Единая смена — чтобы изолировать логику недель
const solverWorkloads = ds.workloads.map((w) => {
    const c = classById.get(w.classId)!;
    const s = subjectById.get(w.subjectId)!;
    const t = teacherById.get(w.teacherId)!;
    return {
        id: w.id, classId: w.classId, groupId: null, subjectId: w.subjectId,
        teacherId: w.teacherId, roomId: null, hoursPerWeek: w.hoursPerWeek,
        weekType: weekTypeByWl.get(w.id), difficulty: w.difficulty,
        additionalClassIds: [], additionalTeacherIds: [],
        schoolClass: { id: c.id, name: c.name, gradeLevel: c.gradeLevel, studentsCount: c.studentsCount, maxLessonsPerDay: null, shift: 1 },
        subject: { id: s.id, name: s.name, difficulty: s.difficulty, sanpinCategory: s.sanpinCategory },
        teacher: { id: t.id, shortName: t.shortName, fullName: t.fullName },
        lessons: [],
    } as any;
});
const solverRooms = ds.rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, type: r.type, isActive: true, schoolId: 1 }));
const version: any = { id: 1, schoolId: 1, workingDays: ds.version.workingDays, maxLessonsPerDay: ds.version.maxLessonsPerDay, weekType: 'odd_even', institutionType: 'school' };

const weeksOverlap = (a: string, b: string) => a === 'both' || b === 'both' || a === b;

(async () => {
    const saved: any[] = [];
    let seq = 1;
    const mock = (i: any) => i;
    const solver = new ScheduleSolverService(
        mock({ find: async () => solverWorkloads }) as any,
        mock({ find: async () => [], create: (o: any) => ({ ...o }), save: async (o: any) => { if (o.id) { const i = saved.findIndex((x: any) => x.id === o.id); if (i >= 0) { saved[i] = o; return o; } } const l = { ...o, id: seq++ }; saved.push(l); return l; }, delete: async () => ({}) }) as any,
        mock({ find: async () => [] }) as any,
        mock({ find: async () => [], delete: async () => ({}), save: async () => ({}) }) as any,
        mock({ findOne: async () => version }) as any,
        mock({ find: async () => solverRooms }) as any,
        new SanpinRulesService(null as any) as any,
    );
    (solver as any).logger = { log: () => {}, warn: () => {}, error: (m: string) => console.log('[err]', m) };

    const t0 = Date.now();
    const result = await solver.solve(1, { mode: 'full', respectLocked: false, maxIterations: 100000, timeoutMs: 60000,
        priorities: { minimizeWindows: 8, teacherPreferences: 5, roomPreferences: 3, evenDistribution: 7 } });

    const totalReq = ds.workloads.reduce((s, w) => s + w.hoursPerWeek, 0);
    console.log('Статус:', result.status, `| размещено ${result.statistics.placedWorkloads}/${totalReq} (${(100 * result.statistics.placedWorkloads / totalReq).toFixed(1)}%) | ${Date.now() - t0} мс`);

    // Разложим по типу недели
    const wlById = new Map(ds.workloads.map((w) => [w.id, w]));
    const wtOf = (l: any) => l.weekType as string;
    for (const wt of ['both', 'odd', 'even']) {
        const req = ds.workloads.filter((w) => weekTypeByWl.get(w.id) === wt).reduce((s, w) => s + w.hoursPerWeek, 0);
        const pl = saved.filter((l) => wtOf(l) === wt).length;
        if (req) console.log(`  ${wt}: ${pl}/${req}`);
    }

    // Аудит конфликтов с учётом недель
    const groups = { teacher: new Map<string, string[]>(), cls: new Map<string, string[]>(), room: new Map<string, string[]>() };
    const push = (m: Map<string, string[]>, k: string, wt: string) => { const a = m.get(k); if (a) a.push(wt); else m.set(k, [wt]); };
    const classSlotWeeks = new Map<string, Set<string>>();
    for (const l of saved) {
        const w = wlById.get(l.workloadId)!; const key = `${l.dayOfWeek}-${l.lessonNumber}`; const wt = wtOf(l);
        push(groups.teacher, `${w.teacherId}|${key}`, wt);
        push(groups.cls, `${w.classId}|${key}`, wt);
        if (l.roomId) push(groups.room, `${l.roomId}|${key}`, wt);
        const ck = `${w.classId}|${key}`; const s = classSlotWeeks.get(ck); if (s) s.add(wt); else classSlotWeeks.set(ck, new Set([wt]));
    }
    const clashes = (m: Map<string, string[]>) => {
        let n = 0;
        for (const arr of m.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (weeksOverlap(arr[i], arr[j])) n++;
        return n;
    };
    const tClash = clashes(groups.teacher), cClash = clashes(groups.cls), rClash = clashes(groups.room);

    // Совмещения нечёт+чёт в одном слоте у класса (доказательство работы двух недель)
    let sharedOddEven = 0;
    for (const s of classSlotWeeks.values()) if (s.has('odd') && s.has('even')) sharedOddEven++;

    // СанПиН по дню (период считается один раз, даже если odd+even делят его)
    const classDayPeriods = new Map<string, Set<number>>();
    for (const l of saved) { const w = wlById.get(l.workloadId)!; const k = `${w.classId}-${l.dayOfWeek}`; const s = classDayPeriods.get(k) || new Set<number>(); s.add(l.lessonNumber); classDayPeriods.set(k, s); }
    let sanpinOver = 0;
    for (const [k, set] of classDayPeriods) { const grade = classById.get(Number(k.split('-')[0]))!.gradeLevel; if (set.size > (DEFAULT_SANPIN_RULES.MAX_LESSONS_PER_DAY[grade] || 7)) sanpinOver++; }

    console.log('\nАудит (с учётом недель): накладки учитель=' + tClash + ', класс=' + cClash + ', кабинет=' + rClash + ', СанПиН=' + sanpinOver);
    console.log('Совмещений нечёт+чёт в одном слоте у класса (норма — так и задумано):', sharedOddEven);

    if (result.unplacedDetails && result.unplacedDetails.length) {
        const by = new Map<string, number>();
        result.unplacedDetails.forEach((d) => { const r = d.reason.replace(/\s*\(.*/, ''); by.set(r, (by.get(r) || 0) + 1); });
        console.log('Причины неразмещения:', [...by.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}× ${r}`).join('; '));
    }

    const ok = result.status !== 'failed' && tClash === 0 && cClash === 0 && rClash === 0 && sanpinOver === 0;
    console.log('\nИТОГ:', ok ? '✅ Двухнедельный режим корректен: чёт/нечёт не конфликтуют, накладок нет.' : '❌ Есть проблемы (см. выше).');
})();
