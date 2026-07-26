/**
 * Тип образовательного учреждения и адаптация терминологии
 */

export type InstitutionType = 'school' | 'college' | 'university';

export interface InstitutionTerms {
    type: InstitutionType;
    label: string;
    // Классы / Группы
    classLabel: string;
    classLabelPlural: string;
    classLabelAcc: string;      // винительный: «Добавить класс/группу»
    // Уроки / Пары
    lessonLabel: string;
    lessonLabelPlural: string;
    // Ученики / Студенты
    studentLabel: string;
    studentLabelPlural: string;
    studentGenPlural: string;   // родительный мн.: «Учеников/Студентов»
    // Учителя / Преподаватели
    teacherLabel: string;
    teacherLabelPlural: string;
    teacherLabelAcc: string;    // винительный: «Добавить учителя/преподавателя»
    // Кабинеты / Аудитории
    roomLabel: string;
    roomLabelPlural: string;
    roomLabelAcc: string;       // винительный: «Добавить кабинет/аудиторию»
    // Параллель / Курс
    gradeLevelLabel: string;
    gradeLevelShort: string;    // краткая форма для таблиц: «Параллель/Курс»
    gradeLevelMin: number;
    gradeLevelMax: number;
    // Параметры расписания
    defaultLessonDuration: number;  // минуты (45 / 90)
    defaultMaxLessons: number;      // макс в день
    academicHoursPerLesson: number; // 1 для школ, 2 для пар
    hasSanpin: boolean;
    // Предложные формы для вкладок
    byClassTab: string;     // "По классам" / "По группам"
    byTeacherTab: string;   // "По учителям" / "По преподавателям"
    byRoomTab: string;      // "По кабинетам" / "По аудиториям"
}

const TERMS: Record<InstitutionType, InstitutionTerms> = {
    school: {
        type: 'school',
        label: 'Школа',
        classLabel: 'Класс',
        classLabelPlural: 'Классы',
        classLabelAcc: 'класс',
        lessonLabel: 'Урок',
        lessonLabelPlural: 'Уроки',
        studentLabel: 'Ученик',
        studentLabelPlural: 'Ученики',
        studentGenPlural: 'Учеников',
        teacherLabel: 'Учитель',
        teacherLabelPlural: 'Учителя',
        teacherLabelAcc: 'учителя',
        roomLabel: 'Кабинет',
        roomLabelPlural: 'Кабинеты',
        roomLabelAcc: 'кабинет',
        gradeLevelLabel: 'Параллель (1-11)',
        gradeLevelShort: 'Параллель',
        gradeLevelMin: 1,
        gradeLevelMax: 11,
        defaultLessonDuration: 45,
        defaultMaxLessons: 7,
        academicHoursPerLesson: 1,
        hasSanpin: true,
        byClassTab: 'По классам',
        byTeacherTab: 'По учителям',
        byRoomTab: 'По кабинетам',
    },
    college: {
        type: 'college',
        label: 'Колледж / Техникум',
        classLabel: 'Группа',
        classLabelPlural: 'Группы',
        classLabelAcc: 'группу',
        lessonLabel: 'Пара',
        lessonLabelPlural: 'Пары',
        studentLabel: 'Студент',
        studentLabelPlural: 'Студенты',
        studentGenPlural: 'Студентов',
        teacherLabel: 'Преподаватель',
        teacherLabelPlural: 'Преподаватели',
        teacherLabelAcc: 'преподавателя',
        roomLabel: 'Аудитория',
        roomLabelPlural: 'Аудитории',
        roomLabelAcc: 'аудиторию',
        gradeLevelLabel: 'Курс (1-4)',
        gradeLevelShort: 'Курс',
        gradeLevelMin: 1,
        gradeLevelMax: 4,
        defaultLessonDuration: 90,
        defaultMaxLessons: 4,
        academicHoursPerLesson: 2,
        hasSanpin: false,
        byClassTab: 'По группам',
        byTeacherTab: 'По преподавателям',
        byRoomTab: 'По аудиториям',
    },
    university: {
        type: 'university',
        label: 'Университет / ВУЗ',
        classLabel: 'Группа',
        classLabelPlural: 'Группы',
        classLabelAcc: 'группу',
        lessonLabel: 'Пара',
        lessonLabelPlural: 'Пары',
        studentLabel: 'Студент',
        studentLabelPlural: 'Студенты',
        studentGenPlural: 'Студентов',
        teacherLabel: 'Преподаватель',
        teacherLabelPlural: 'Преподаватели',
        teacherLabelAcc: 'преподавателя',
        roomLabel: 'Аудитория',
        roomLabelPlural: 'Аудитории',
        roomLabelAcc: 'аудиторию',
        gradeLevelLabel: 'Курс (1-6)',
        gradeLevelShort: 'Курс',
        gradeLevelMin: 1,
        gradeLevelMax: 6,
        defaultLessonDuration: 90,
        defaultMaxLessons: 5,
        academicHoursPerLesson: 2,
        hasSanpin: false,
        byClassTab: 'По группам',
        byTeacherTab: 'По преподавателям',
        byRoomTab: 'По аудиториям',
    },
};

export function getTerms(type?: InstitutionType | string): InstitutionTerms {
    if (type && type in TERMS) return TERMS[type as InstitutionType];
    return TERMS.school;
}

export const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
    { value: 'school', label: 'Школа' },
    { value: 'college', label: 'Колледж / Техникум' },
    { value: 'university', label: 'Университет / ВУЗ' },
];

/**
 * Генерация расписания звонков по умолчанию
 */
export function getDefaultBellSchedule(type: InstitutionType, shift: number = 1): {
    lessonNumber: number; startTime: string; endTime: string; breakAfter: number;
}[] {
    const isSchool = type === 'school';
    const base = shift === 1 ? (isSchool ? 8 * 60 + 30 : 8 * 60 + 30) : (isSchool ? 13 * 60 : 13 * 60 + 30);
    const duration = isSchool ? 45 : 90;
    const maxItems = isSchool ? 7 : (type === 'college' ? 4 : 5);
    const breaks = isSchool ? [10, 10, 20, 10, 10, 10, 10] : [10, 20, 10, 10, 10];

    const result = [];
    let time = base;
    for (let i = 0; i < maxItems; i++) {
        const sH = String(Math.floor(time / 60)).padStart(2, '0');
        const sM = String(time % 60).padStart(2, '0');
        const end = time + duration;
        const eH = String(Math.floor(end / 60)).padStart(2, '0');
        const eM = String(end % 60).padStart(2, '0');
        result.push({
            lessonNumber: i + 1,
            startTime: `${sH}:${sM}`,
            endTime: `${eH}:${eM}`,
            breakAfter: breaks[i] || 10,
        });
        time = end + (breaks[i] || 10);
    }
    return result;
}
