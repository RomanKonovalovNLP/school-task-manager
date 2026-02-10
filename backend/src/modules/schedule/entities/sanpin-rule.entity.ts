import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';
import { SanpinRuleType } from './enums';

// Реэкспорт для обратной совместимости
export { SanpinRuleType } from './enums';

@Entity('sanpin_rules')
export class SanpinRule {
    @PrimaryGeneratedColumn()
    id: number;

    // Уникальный код правила
    @Column({ type: 'varchar', length: 50, unique: true })
    code: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text' })
    description: string;

    // Для каких классов применяется (null = для всех)
    @Column({ name: 'grade_from', type: 'int', nullable: true })
    gradeFrom: number;

    @Column({ name: 'grade_to', type: 'int', nullable: true })
    gradeTo: number;

    @Column({
        name: 'rule_type',
        type: 'enum',
        enum: SanpinRuleType,
    })
    ruleType: SanpinRuleType;

    // Значение правила (JSON)
    // Например: { "value": 5 } или { "lessons": [2, 3, 4] }
    @Column({ name: 'rule_value', type: 'jsonb' })
    ruleValue: Record<string, any>;

    // Hard constraint (обязательное) или soft (рекомендация)
    @Column({ name: 'is_hard', type: 'boolean', default: true })
    isHard: boolean;

    // Штраф за нарушение (для soft constraints)
    @Column({ type: 'int', default: 1 })
    penalty: number;

    // Ссылка на документ СанПиН
    @Column({ name: 'document_ref', type: 'varchar', length: 255, nullable: true })
    documentRef: string;

    // Правило активно
    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;
}
