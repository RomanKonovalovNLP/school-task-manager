/**
 * Единый генератор тестовых данных для «Школа №1 г. Москва».
 * Используется и симулятором солвера (scripts/solver-sim.ts),
 * и сидером реальной БД (scripts/seed-school1.ts) — данные идентичны.
 */

export interface DSubject { id: number; name: string; shortName: string; color: string; sanpinCategory: string; difficulty: number; }
export interface DRoom { id: number; name: string; capacity: number; floor: number; type: string; }
export interface DClass { id: number; name: string; gradeLevel: number; studentsCount: number; shift: number; color: string; }
export interface DTeacher { id: number; fullName: string; shortName: string; color: string; subjectIds: number[]; }
export interface DWorkload { id: number; classId: number; subjectId: number; teacherId: number; hoursPerWeek: number; difficulty: number; }
export interface Dataset {
    schoolName: string;
    subjects: DSubject[];
    rooms: DRoom[];
    classes: DClass[];
    teachers: DTeacher[];
    workloads: DWorkload[];
    version: { name: string; type: string; weekType: string; workingDays: number; maxLessonsPerDay: number };
    bells: { lessonNumber: number; startTime: string; endTime: string; breakAfter: number }[];
}

// Предметы: код -> описание
const SUBJECTS: Record<string, Omit<DSubject, 'id'>> = {
    RUS:   { name: 'Русский язык',        shortName: 'Рус',   color: '#e53935', sanpinCategory: 'русский_язык',    difficulty: 11 },
    LIT:   { name: 'Литература',          shortName: 'Лит',   color: '#8e24aa', sanpinCategory: 'литература',       difficulty: 10 },
    MAT:   { name: 'Математика',          shortName: 'Мат',   color: '#3949ab', sanpinCategory: 'математика',       difficulty: 13 },
    INF:   { name: 'Информатика',         shortName: 'Инф',   color: '#00897b', sanpinCategory: 'информатика',      difficulty: 10 },
    ENG:   { name: 'Английский язык',     shortName: 'Англ',  color: '#039be5', sanpinCategory: 'иностранный_язык', difficulty: 12 },
    HIST:  { name: 'История',             shortName: 'Ист',   color: '#6d4c41', sanpinCategory: 'история',          difficulty: 9  },
    SOC:   { name: 'Обществознание',      shortName: 'Общ',   color: '#546e7a', sanpinCategory: 'обществознание',   difficulty: 8  },
    GEOG:  { name: 'География',           shortName: 'Гео',   color: '#43a047', sanpinCategory: 'география',        difficulty: 9  },
    PHYS:  { name: 'Физика',              shortName: 'Физ',   color: '#1e88e5', sanpinCategory: 'физика',           difficulty: 12 },
    CHEM:  { name: 'Химия',               shortName: 'Хим',   color: '#00acc1', sanpinCategory: 'химия',            difficulty: 12 },
    BIO:   { name: 'Биология',            shortName: 'Био',   color: '#7cb342', sanpinCategory: 'биология',         difficulty: 10 },
    WORLD: { name: 'Окружающий мир',      shortName: 'Окр',   color: '#fb8c00', sanpinCategory: 'другое',           difficulty: 6  },
    PE:    { name: 'Физкультура',         shortName: 'Физ-ра',color: '#f4511e', sanpinCategory: 'физкультура',      difficulty: 2  },
    MUS:   { name: 'Музыка',              shortName: 'Муз',   color: '#d81b60', sanpinCategory: 'музыка',           difficulty: 5  },
    ART:   { name: 'ИЗО',                 shortName: 'ИЗО',   color: '#c0ca33', sanpinCategory: 'изо',              difficulty: 4  },
    TECH:  { name: 'Технология',          shortName: 'Тех',   color: '#8d6e63', sanpinCategory: 'технология',       difficulty: 3  },
    OBZH:  { name: 'ОБЖ',                 shortName: 'ОБЖ',   color: '#455a64', sanpinCategory: 'другое',           difficulty: 5  },
    ASTR:  { name: 'Астрономия',          shortName: 'Астр',  color: '#5e35b1', sanpinCategory: 'астрономия',       difficulty: 8  },
};

// Учебный план: класс(grade) -> предмет -> часов/нед
const CURRICULUM: Record<number, Record<string, number>> = {
    1:  { RUS: 4, LIT: 4, MAT: 4, WORLD: 2, PE: 3, MUS: 1, ART: 1 },                                             // 19
    2:  { RUS: 4, LIT: 4, MAT: 4, ENG: 2, WORLD: 2, PE: 3, MUS: 1, ART: 1, TECH: 1 },                            // 22
    3:  { RUS: 4, LIT: 4, MAT: 4, ENG: 2, WORLD: 2, PE: 3, MUS: 1, ART: 1, TECH: 1 },                            // 22
    4:  { RUS: 4, LIT: 4, MAT: 4, ENG: 2, WORLD: 2, PE: 3, MUS: 1, ART: 1, TECH: 1 },                            // 22
    5:  { RUS: 5, LIT: 3, MAT: 5, ENG: 3, HIST: 2, BIO: 1, GEOG: 1, PE: 3, MUS: 1, ART: 1, TECH: 2 },            // 27
    6:  { RUS: 5, LIT: 3, MAT: 5, ENG: 3, HIST: 2, SOC: 1, GEOG: 1, BIO: 1, PE: 3, MUS: 1, ART: 1, TECH: 2 },    // 28
    7:  { RUS: 4, LIT: 2, MAT: 5, ENG: 3, INF: 1, HIST: 2, SOC: 1, GEOG: 2, BIO: 2, PHYS: 2, PE: 3, MUS: 1, ART: 1, TECH: 2 }, // 31
    8:  { RUS: 3, LIT: 2, MAT: 5, ENG: 3, INF: 1, HIST: 2, SOC: 1, GEOG: 2, BIO: 2, PHYS: 2, CHEM: 2, OBZH: 1, PE: 3, MUS: 1, ART: 1, TECH: 1 }, // 32
    9:  { RUS: 3, LIT: 3, MAT: 5, ENG: 3, INF: 1, HIST: 2, SOC: 1, GEOG: 2, BIO: 2, PHYS: 3, CHEM: 2, OBZH: 1, PE: 3 }, // 32
    10: { RUS: 2, LIT: 3, MAT: 6, ENG: 3, INF: 1, HIST: 2, SOC: 2, GEOG: 1, BIO: 2, PHYS: 3, CHEM: 2, OBZH: 1, PE: 3, TECH: 2 }, // 33
    11: { RUS: 2, LIT: 3, MAT: 6, ENG: 3, INF: 1, HIST: 2, SOC: 2, GEOG: 1, BIO: 2, PHYS: 3, CHEM: 2, ASTR: 1, OBZH: 1, PE: 3, TECH: 1 }, // 33
};

const PARALLELS = ['А', 'Б', 'В'];

const SURNAMES = [
    'Иванов', 'Петров', 'Смирнова', 'Кузнецова', 'Попов', 'Соколова', 'Лебедев', 'Козлова', 'Новикова', 'Морозов',
    'Волкова', 'Соловьёв', 'Васильева', 'Зайцева', 'Павлов', 'Семёнова', 'Голубев', 'Виноградова', 'Богданов', 'Воробьёва',
    'Фёдорова', 'Михайлов', 'Беляева', 'Тарасова', 'Белов', 'Комарова', 'Орлова', 'Киселёв', 'Макарова', 'Андреева',
    'Ковалёв', 'Ильина', 'Гусева', 'Титов', 'Кузьмина', 'Кудрявцева', 'Баранова', 'Куликова', 'Алексеева', 'Степанова',
    'Яковлев', 'Сорокина', 'Сергеева', 'Романова', 'Захарова', 'Борисова', 'Королёва', 'Герасимова', 'Пономарёва', 'Григорьев',
    'Лазарева', 'Медведева', 'Ершова', 'Никитина', 'Соболева', 'Рябова', 'Полякова', 'Цветкова', 'Данилова', 'Жукова',
];
const INITIALS = ['А.А.', 'И.В.', 'С.П.', 'Е.Н.', 'М.Ю.', 'О.С.', 'Д.А.', 'Т.И.', 'Н.В.', 'Л.П.', 'В.М.', 'Г.Е.', 'Р.О.', 'К.Д.', 'Ф.Т.'];

export function buildDataset(): Dataset {
    // 1) Предметы
    const subjectCodes = Object.keys(SUBJECTS);
    const subjects: DSubject[] = subjectCodes.map((code, i) => ({ id: i + 1, ...SUBJECTS[code] }));
    const codeToSubjectId: Record<string, number> = {};
    subjectCodes.forEach((code, i) => (codeToSubjectId[code] = i + 1));

    // 2) Классы: 1..11 × А,Б,В = 33
    const classes: DClass[] = [];
    let classId = 1;
    for (let grade = 1; grade <= 11; grade++) {
        for (const p of PARALLELS) {
            const shift = grade >= 5 && grade <= 8 ? 2 : 1; // 5-8 классы — вторая смена
            classes.push({
                id: classId++,
                name: `${grade}${p}`,
                gradeLevel: grade,
                studentsCount: 24 + ((grade + p.charCodeAt(0)) % 7), // 24..30
                shift,
                color: shift === 2 ? '#8e24aa' : '#2196F3',
            });
        }
    }

    // 3) Кабинеты
    const rooms: DRoom[] = [];
    let roomId = 1;
    const addRoom = (name: string, capacity: number, floor: number, type: string) => rooms.push({ id: roomId++, name, capacity, floor, type });
    for (let i = 1; i <= 28; i++) addRoom(`Каб. ${100 + i}`, 30, 1 + (i % 3), 'regular'); // обычные
    for (let i = 1; i <= 3; i++) addRoom(`Информатика ${i}`, 28, 2, 'computer');
    for (let i = 1; i <= 3; i++) addRoom(`Спортзал ${i}`, 40, 0, 'gym');
    addRoom('Физика (лаб.)', 30, 3, 'laboratory');
    addRoom('Химия (лаб.)', 30, 3, 'laboratory');
    addRoom('Биология (лаб.)', 30, 3, 'laboratory');
    addRoom('Музыка', 32, 2, 'music');
    addRoom('Музыка 2', 32, 2, 'music');
    addRoom('ИЗО', 32, 2, 'art');
    addRoom('ИЗО 2', 32, 2, 'art');
    for (let i = 1; i <= 3; i++) addRoom(`Мастерская ${i}`, 26, 0, 'workshop');
    addRoom('Актовый зал', 120, 1, 'assembly');
    addRoom('Библиотека', 40, 1, 'library');

    // 4) Собираем спрос по предметам: список (classId, hours)
    const demandBySubject: Record<string, { classId: number; hours: number }[]> = {};
    for (const cls of classes) {
        const plan = CURRICULUM[cls.gradeLevel];
        for (const code of Object.keys(plan)) {
            (demandBySubject[code] ||= []).push({ classId: cls.id, hours: plan[code] });
        }
    }

    // 5) Учителя + нагрузки: на каждый предмет — пул учителей, классы раздаются по кругу
    const teachers: DTeacher[] = [];
    const workloads: DWorkload[] = [];
    let teacherId = 1, workloadId = 1, surnameIdx = 0;
    const TARGET_PER_TEACHER = 22; // ориентир недельной нагрузки

    for (const code of subjectCodes) {
        const demand = demandBySubject[code];
        if (!demand || demand.length === 0) continue;
        const totalHours = demand.reduce((s, d) => s + d.hours, 0);
        const poolSize = Math.max(1, Math.ceil(totalHours / TARGET_PER_TEACHER));
        const subjId = codeToSubjectId[code];

        // создаём учителей пула
        const pool: DTeacher[] = [];
        for (let k = 0; k < poolSize; k++) {
            const surname = SURNAMES[surnameIdx % SURNAMES.length];
            const initials = INITIALS[(surnameIdx * 7 + k) % INITIALS.length];
            surnameIdx++;
            const t: DTeacher = {
                id: teacherId++,
                fullName: `${surname} ${initials} (${SUBJECTS[code].name})`,
                shortName: `${surname} ${initials}`,
                color: SUBJECTS[code].color,
                subjectIds: [subjId],
            };
            teachers.push(t); pool.push(t);
        }

        // раздаём классы по кругу, балансируя часы
        const load = new Map<number, number>(pool.map((t) => [t.id, 0]));
        const sortedDemand = [...demand].sort((a, b) => b.hours - a.hours);
        for (const d of sortedDemand) {
            // выбираем наименее загруженного учителя пула
            let best = pool[0];
            for (const t of pool) if ((load.get(t.id) || 0) < (load.get(best.id) || 0)) best = t;
            load.set(best.id, (load.get(best.id) || 0) + d.hours);
            workloads.push({
                id: workloadId++,
                classId: d.classId,
                subjectId: subjId,
                teacherId: best.id,
                hoursPerWeek: d.hours,
                difficulty: SUBJECTS[code].difficulty,
            });
        }
    }

    // 6) Версия + звонки
    const bells = [
        { lessonNumber: 1, startTime: '08:30', endTime: '09:15', breakAfter: 10 },
        { lessonNumber: 2, startTime: '09:25', endTime: '10:10', breakAfter: 20 },
        { lessonNumber: 3, startTime: '10:30', endTime: '11:15', breakAfter: 20 },
        { lessonNumber: 4, startTime: '11:35', endTime: '12:20', breakAfter: 10 },
        { lessonNumber: 5, startTime: '12:30', endTime: '13:15', breakAfter: 10 },
        { lessonNumber: 6, startTime: '13:25', endTime: '14:10', breakAfter: 10 },
        { lessonNumber: 7, startTime: '14:20', endTime: '15:05', breakAfter: 0 },
    ];

    return {
        schoolName: 'Школа №1 г. Москва',
        subjects, rooms, classes, teachers, workloads,
        version: { name: 'Основное расписание 2025/2026', type: 'template', weekType: 'single', workingDays: 31, maxLessonsPerDay: 7 },
        bells,
    };
}

// Быстрая сводка (для отладки)
export function datasetSummary(ds: Dataset): string {
    const totalHours = ds.workloads.reduce((s, w) => s + w.hoursPerWeek, 0);
    return `Школа: ${ds.schoolName}\nКлассов: ${ds.classes.length}, учителей: ${ds.teachers.length}, предметов: ${ds.subjects.length}, кабинетов: ${ds.rooms.length}\nНагрузок: ${ds.workloads.length}, суммарно уроков/нед: ${totalHours}`;
}
