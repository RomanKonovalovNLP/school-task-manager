import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Teacher } from './teacher.entity';

@Entity('teacher_availability')
@Index(['teacherId', 'dayOfWeek', 'lessonNumber'], { unique: true })
export class TeacherAvailability {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'teacher_id' })
    teacherId: number;

    @ManyToOne(() => Teacher, (teacher) => teacher.availability, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'teacher_id' })
    teacher: Teacher;

    // День недели (1-7)
    @Column({ name: 'day_of_week', type: 'int' })
    dayOfWeek: number;

    // Номер урока (1-8)
    @Column({ name: 'lesson_number', type: 'int' })
    lessonNumber: number;

    // Доступен ли учитель в это время
    @Column({ name: 'is_available', type: 'boolean', default: true })
    isAvailable: boolean;

    // Предпочтение: -2 (крайне нежелательно) до +2 (предпочтительно)
    // 0 = нейтрально
    @Column({ type: 'int', default: 0 })
    preference: number;

    // Причина недоступности (опционально)
    @Column({ type: 'varchar', length: 255, nullable: true })
    reason: string;
}
