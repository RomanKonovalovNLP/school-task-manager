import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Workload } from './workload.entity';
import { ScheduleLesson } from './schedule-lesson.entity';
import { BellSchedule } from './bell-schedule.entity';
import { ScheduleConflict } from './schedule-conflict.entity';
import { ScheduleVersionType, WeekType, ScheduleStatus } from './enums';

// Реэкспорт для обратной совместимости
export { ScheduleVersionType, WeekType, ScheduleStatus } from './enums';

@Entity('schedule_versions')
export class ScheduleVersion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255 })
    name: string; // "Расписание 2025-2026", "1 четверть"

    @Column({
        type: 'enum',
        enum: ScheduleVersionType,
        default: ScheduleVersionType.TEMPLATE,
    })
    type: ScheduleVersionType;

    @Column({
        name: 'week_type',
        type: 'enum',
        enum: WeekType,
        default: WeekType.SINGLE,
    })
    weekType: WeekType;

    @Column({
        type: 'enum',
        enum: ScheduleStatus,
        default: ScheduleStatus.DRAFT,
    })
    status: ScheduleStatus;

    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: Date;

    @Column({ name: 'end_date', type: 'date', nullable: true })
    endDate: Date;

    @Column({ name: 'is_active', type: 'boolean', default: false })
    isActive: boolean; // Активное расписание для отображения

    // Дни недели (битовая маска: 1=Пн, 2=Вт, 4=Ср, 8=Чт, 16=Пт, 32=Сб)
    @Column({ name: 'working_days', type: 'int', default: 31 }) // Пн-Пт
    workingDays: number;

    @Column({ name: 'max_lessons_per_day', type: 'int', default: 7 })
    maxLessonsPerDay: number;

    @Column({ name: 'copied_from_id', type: 'int', nullable: true })
    copiedFromId: number;

    @OneToMany(() => Workload, (workload) => workload.version)
    workloads: Workload[];

    @OneToMany(() => ScheduleLesson, (lesson) => lesson.version)
    lessons: ScheduleLesson[];

    @OneToMany(() => BellSchedule, (bell) => bell.version)
    bellSchedule: BellSchedule[];

    @OneToMany(() => ScheduleConflict, (conflict) => conflict.version)
    conflicts: ScheduleConflict[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
