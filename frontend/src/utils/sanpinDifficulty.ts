/**
 * Шкала трудности учебных предметов по СанПиН
 * Источник: СанПиН 2.4.2.2821-10
 * 
 * Возвращает ранг трудности предмета для заданного класса.
 * Если предмет отсутствует для данного класса — возвращает undefined.
 */

// 1-4 классы
const DIFFICULTY_1_4: Record<string, number> = {
    'математика': 8,
    'русский_язык': 7,
    'иностранный_язык': 7,
    'информатика': 6,
    'биология': 6,    // природоведение
    'литература': 5,
    'история': 4,
    'музыка': 3,
    'изо': 3,
    'технология': 2,
    'физкультура': 1,
    'другое': 3,
};

// 5-9 классы: difficulty[категория][класс]
const DIFFICULTY_5_9: Record<string, Record<number, number>> = {
    'химия':              { 7: 13, 8: 10, 9: 12 },
    'физика':             { 7: 8, 8: 9, 9: 13 },
    'математика':         { 5: 10, 6: 13 },
    'биология':           { 5: 10, 6: 8, 7: 7, 8: 7, 9: 7 },
    'иностранный_язык':   { 5: 9, 6: 11, 7: 10, 8: 8, 9: 9 },
    'русский_язык':       { 5: 8, 6: 12, 7: 11, 8: 7, 9: 6 },
    'литература':         { 5: 4, 6: 6, 7: 4, 8: 4, 9: 7 },
    'география':          { 6: 7, 7: 6, 8: 6, 9: 5 },
    'история':            { 5: 5, 6: 8, 7: 6, 8: 8, 9: 10 },
    'обществознание':     { 6: 9, 7: 9, 8: 5 },
    'информатика':        { 5: 4, 6: 10, 7: 4, 8: 7, 9: 7 },
    'музыка':             { 5: 2, 6: 1, 7: 1, 8: 1 },
    'изо':                { 5: 3, 6: 3, 7: 1, 8: 3 },
    'технология':         { 5: 4, 6: 3, 7: 2, 8: 1, 9: 4 },
    'физкультура':        { 5: 3, 6: 4, 7: 2, 8: 2, 9: 2 },
    'астрономия':         {},
    'другое':             { 5: 5, 6: 5, 7: 5, 8: 5, 9: 5 },
};

// 10-11 классы
const DIFFICULTY_10_11: Record<string, number> = {
    'физика': 12,
    'химия': 11,
    'математика': 10,    // алгебра + геометрия
    'русский_язык': 9,
    'литература': 8,
    'иностранный_язык': 8,
    'биология': 7,
    'информатика': 6,
    'история': 5,
    'обществознание': 5,
    'астрономия': 4,
    'география': 3,
    'физкультура': 1,
    'технология': 2,
    'изо': 2,
    'музыка': 2,
    'другое': 4,
};

/**
 * Получить сложность предмета по категории СанПиН и классу
 * @param category - категория СанПиН (ключ из SanpinCategory enum)
 * @param gradeLevel - класс (1-11)
 * @returns сложность (1-13) или undefined если нет данных
 */
export function getSanpinDifficulty(category: string, gradeLevel: number): number | undefined {
    if (!category || !gradeLevel) return undefined;

    if (gradeLevel >= 1 && gradeLevel <= 4) {
        return DIFFICULTY_1_4[category];
    }

    if (gradeLevel >= 5 && gradeLevel <= 9) {
        const subjectMap = DIFFICULTY_5_9[category];
        if (subjectMap) {
            return subjectMap[gradeLevel];
        }
        return undefined;
    }

    if (gradeLevel >= 10 && gradeLevel <= 11) {
        return DIFFICULTY_10_11[category];
    }

    return undefined;
}

/**
 * Получить среднюю сложность предмета по категории (для случая когда класс не указан)
 */
export function getAverageDifficulty(category: string): number {
    if (!category) return 5;

    // Собираем все значения для этой категории
    const values: number[] = [];

    if (DIFFICULTY_1_4[category]) values.push(DIFFICULTY_1_4[category]);
    
    const mid = DIFFICULTY_5_9[category];
    if (mid) {
        Object.values(mid).forEach(v => values.push(v));
    }

    if (DIFFICULTY_10_11[category]) values.push(DIFFICULTY_10_11[category]);

    if (values.length === 0) return 5;

    return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
