import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';
import { ConflictType, ConflictCategory } from './enums';

// Реэкспорт для обратной совместимости
export { ConflictType, ConflictCategory } from './enums';

@Entity('schedule_conflicts')
export class ScheduleConflict {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'version_id' })
    versionId: number;

    @ManyToOne(() => ScheduleVersion, (version) => version.conflicts, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'version_id' })
    version: ScheduleVersion;

    @Column({
        type: 'enum',
        enum: ConflictType,
    })
    type: ConflictType;

    @Column({
        type: 'enum',
        enum: ConflictCategory,
    })
    category: ConflictCategory;

    // Человекочитаемое описание конфликта
    @Column({ type: 'text' })
    description: string;

    // ID затронутых уроков (JSON массив)
    @Column({ name: 'affected_lessons', type: 'simple-array', nullable: true })
    affectedLessons: number[];

    // ID затронутых объектов (учителя, классы, кабинеты)
    @Column({ name: 'affected_objects', type: 'jsonb', nullable: true })
    affectedObjects: {
        teacherIds?: number[];
        classIds?: number[];
        roomIds?: number[];
        workloadIds?: number[];
    };

    // Ссылка на пункт СанПиН (если применимо)
    @Column({ name: 'sanpin_reference', type: 'varchar', length: 255, nullable: true })
    sanpinReference: string;

    // Серьёзность конфликта (1-10)
    @Column({ type: 'int', default: 5 })
    severity: number;

    // День и урок, где возник конфликт
    @Column({ name: 'day_of_week', type: 'int', nullable: true })
    dayOfWeek: number;

    @Column({ name: 'lesson_number', type: 'int', nullable: true })
    lessonNumber: number;

    // Конфликт разрешён
    @Column({ name: 'is_resolved', type: 'boolean', default: false })
    isResolved: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
