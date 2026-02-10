import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('lesson_types')
export class LessonType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 100 })
    name: string; // "Лекция", "Практика", "Лабораторная", "Факультатив"

    @Column({ name: 'short_name', type: 'varchar', length: 20 })
    shortName: string; // "Лек", "Практ", "Лаб"

    @Column({ type: 'varchar', length: 7, default: '#9E9E9E' })
    color: string;

    // Отображать в печатной версии
    @Column({ name: 'show_in_print', type: 'boolean', default: true })
    showInPrint: boolean;

    // Порядок сортировки
    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;
}
