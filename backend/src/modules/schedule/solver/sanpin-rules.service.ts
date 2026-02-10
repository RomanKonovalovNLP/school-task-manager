import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SanpinRule, SanpinRuleType } from '../entities/sanpin-rule.entity';
import { SchoolClass } from '../entities/school-class.entity';
import { Subject, SanpinCategory } from '../entities/subject.entity';

// Предустановленные правила СанПиН 1.2.3685-21
export const DEFAULT_SANPIN_RULES = {
    // Максимальное количество уроков в день по классам
    MAX_LESSONS_PER_DAY: {
        1: 4,
        2: 5, 3: 5, 4: 5,
        5: 6, 6: 6,
        7: 7, 8: 7, 9: 7, 10: 7, 11: 7,
    },

    // Максимальная недельная нагрузка (часов)
    MAX_WEEKLY_HOURS: {
        1: 21,
        2: 23, 3: 23, 4: 23,
        5: 29,
        6: 30,
        7: 32,
        8: 33, 9: 33,
        10: 34, 11: 34,
    },

    // Шкала сложности предметов (баллы)
    SUBJECT_DIFFICULTY: {
        [SanpinCategory.MATHEMATICS]: 13,
        [SanpinCategory.FOREIGN_LANGUAGE]: 12,
        [SanpinCategory.PHYSICS]: 12,
        [SanpinCategory.CHEMISTRY]: 12,
        [SanpinCategory.RUSSIAN_LANGUAGE]: 11,
        [SanpinCategory.LITERATURE]: 10,
        [SanpinCategory.BIOLOGY]: 10,
        [SanpinCategory.INFORMATICS]: 10,
        [SanpinCategory.GEOGRAPHY]: 9,
        [SanpinCategory.HISTORY]: 9,
        [SanpinCategory.SOCIAL_STUDIES]: 8,
        [SanpinCategory.ASTRONOMY]: 8,
        [SanpinCategory.MUSIC]: 5,
        [SanpinCategory.ART]: 4,
        [SanpinCategory.TECHNOLOGY]: 3,
        [SanpinCategory.PHYSICAL_EDUCATION]: 2,
        [SanpinCategory.OTHER]: 5,
    },

    // Максимальная суммарная сложность в день
    MAX_DAILY_DIFFICULTY: {
        1: 30,
        2: 35, 3: 35, 4: 35,
        5: 45, 6: 45,
        7: 50, 8: 50,
        9: 55, 10: 55, 11: 55,
    },

    // Оптимальные уроки для сложных предметов (2-4)
    HARD_SUBJECTS_OPTIMAL_LESSONS: [2, 3, 4],

    // Уроки, на которых нежелательна физкультура
    PE_SUBOPTIMAL_LESSONS: [1], // Первый урок

    // Минимальная продолжительность перемены (минуты)
    MIN_BREAK_DURATION: 10,

    // Продолжительность большой перемены
    LONG_BREAK_DURATION: 20,

    // После какого урока большая перемена
    LONG_BREAK_AFTER_LESSON: 2,
};

export interface ValidationResult {
    isValid: boolean;
    violations: {
        rule: string;
        type: 'hard' | 'soft';
        description: string;
        objects: string[];
        sanpinRef?: string;
        penalty?: number;
    }[];
}

@Injectable()
export class SanpinRulesService {
    constructor(
        @InjectRepository(SanpinRule)
        private ruleRepo: Repository<SanpinRule>,
    ) {}

    /**
     * Получить правила для версии расписания
     */
    async getRulesForVersion(versionId: number): Promise<SanpinRule[]> {
        return this.ruleRepo.find({
            where: { isActive: true },
        });
    }

    /**
     * Получить максимум уроков в день для класса
     */
    getMaxLessonsPerDay(gradeLevel: number): number {
        return DEFAULT_SANPIN_RULES.MAX_LESSONS_PER_DAY[gradeLevel] || 7;
    }

    /**
     * Получить максимальную недельную нагрузку
     */
    getMaxWeeklyHours(gradeLevel: number): number {
        return DEFAULT_SANPIN_RULES.MAX_WEEKLY_HOURS[gradeLevel] || 34;
    }

    /**
     * Получить сложность предмета
     */
    getSubjectDifficulty(sanpinCategory: SanpinCategory): number {
        return DEFAULT_SANPIN_RULES.SUBJECT_DIFFICULTY[sanpinCategory] || 5;
    }

    /**
     * Получить максимальную сложность дня
     */
    getMaxDailyDifficulty(gradeLevel: number): number {
        return DEFAULT_SANPIN_RULES.MAX_DAILY_DIFFICULTY[gradeLevel] || 55;
    }

    /**
     * Проверить размещение урока
     */
    validateLessonPlacement(
        subject: Subject,
        lessonNumber: number,
        gradeLevel: number,
    ): ValidationResult {
        const violations: ValidationResult['violations'] = [];

        // Проверка размещения сложных предметов
        const difficulty = this.getSubjectDifficulty(subject.sanpinCategory);
        if (difficulty >= 10) {
            const optimalLessons = DEFAULT_SANPIN_RULES.HARD_SUBJECTS_OPTIMAL_LESSONS;
            if (!optimalLessons.includes(lessonNumber)) {
                violations.push({
                    rule: 'HARD_SUBJECT_PLACEMENT',
                    type: 'soft',
                    description: `${subject.name} (сложность ${difficulty}) рекомендуется ставить на ${optimalLessons.join(', ')} уроки`,
                    objects: [subject.name],
                    sanpinRef: 'СанПиН 1.2.3685-21, приложение 3',
                    penalty: difficulty - 9,
                });
            }
        }

        // Проверка физкультуры на первом уроке
        if (subject.sanpinCategory === SanpinCategory.PHYSICAL_EDUCATION) {
            if (DEFAULT_SANPIN_RULES.PE_SUBOPTIMAL_LESSONS.includes(lessonNumber)) {
                violations.push({
                    rule: 'PE_FIRST_LESSON',
                    type: 'soft',
                    description: 'Физкультуру не рекомендуется ставить первым уроком',
                    objects: [subject.name],
                    penalty: 2,
                });
            }
        }

        return {
            isValid: !violations.some(v => v.type === 'hard'),
            violations,
        };
    }

    /**
     * Проверить дневную нагрузку класса
     */
    validateDailyLoad(
        gradeLevel: number,
        lessonsCount: number,
        totalDifficulty: number,
        dayOfWeek: number,
    ): ValidationResult {
        const violations: ValidationResult['violations'] = [];

        // Максимум уроков в день
        const maxLessons = this.getMaxLessonsPerDay(gradeLevel);
        if (lessonsCount > maxLessons) {
            violations.push({
                rule: 'MAX_LESSONS_PER_DAY',
                type: 'hard',
                description: `${lessonsCount} уроков превышает максимум ${maxLessons} для ${gradeLevel} класса`,
                objects: [`${gradeLevel} класс`, `День ${dayOfWeek}`],
                sanpinRef: 'СанПиН 1.2.3685-21, таблица 6.6',
            });
        }

        // Максимальная сложность дня
        const maxDifficulty = this.getMaxDailyDifficulty(gradeLevel);
        if (totalDifficulty > maxDifficulty) {
            violations.push({
                rule: 'MAX_DAILY_DIFFICULTY',
                type: 'soft',
                description: `Суммарная сложность ${totalDifficulty} превышает рекомендуемые ${maxDifficulty} баллов`,
                objects: [`${gradeLevel} класс`, `День ${dayOfWeek}`],
                sanpinRef: 'СанПиН 1.2.3685-21, приложение 3',
                penalty: totalDifficulty - maxDifficulty,
            });
        }

        return {
            isValid: !violations.some(v => v.type === 'hard'),
            violations,
        };
    }

    /**
     * Проверить недельную нагрузку класса
     */
    validateWeeklyLoad(
        gradeLevel: number,
        totalHours: number,
    ): ValidationResult {
        const violations: ValidationResult['violations'] = [];

        const maxHours = this.getMaxWeeklyHours(gradeLevel);
        if (totalHours > maxHours) {
            violations.push({
                rule: 'MAX_WEEKLY_HOURS',
                type: 'hard',
                description: `${totalHours} часов в неделю превышает максимум ${maxHours} для ${gradeLevel} класса`,
                objects: [`${gradeLevel} класс`],
                sanpinRef: 'СанПиН 1.2.3685-21, таблица 6.5',
            });
        }

        return {
            isValid: !violations.some(v => v.type === 'hard'),
            violations,
        };
    }

    /**
     * Инициализация правил СанПиН в базе данных
     */
    async initializeDefaultRules(): Promise<void> {
        const existingRules = await this.ruleRepo.count();
        if (existingRules > 0) return;

        const rules: Partial<SanpinRule>[] = [];

        // Правила максимума уроков
        for (const [grade, maxLessons] of Object.entries(DEFAULT_SANPIN_RULES.MAX_LESSONS_PER_DAY)) {
            rules.push({
                code: `MAX_LESSONS_GRADE_${grade}`,
                name: `Максимум уроков для ${grade} класса`,
                description: `Максимальное количество уроков в день для ${grade} класса`,
                gradeFrom: Number(grade),
                gradeTo: Number(grade),
                ruleType: SanpinRuleType.MAX_LESSONS_PER_DAY,
                ruleValue: { value: maxLessons },
                isHard: true,
                documentRef: 'СанПиН 1.2.3685-21, таблица 6.6',
            });
        }

        // Правила сложности предметов
        for (const [category, difficulty] of Object.entries(DEFAULT_SANPIN_RULES.SUBJECT_DIFFICULTY)) {
            rules.push({
                code: `DIFFICULTY_${category.toUpperCase()}`,
                name: `Сложность: ${category}`,
                description: `Коэффициент сложности для предмета "${category}"`,
                ruleType: SanpinRuleType.SUBJECT_DIFFICULTY,
                ruleValue: { category, difficulty },
                isHard: false,
                documentRef: 'СанПиН 1.2.3685-21, приложение 3',
            });
        }

        await this.ruleRepo.save(rules);
    }
}
