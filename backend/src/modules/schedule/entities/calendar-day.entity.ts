import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';

export enum DayType {
    WORKING = 'working',
    HOLIDAY = 'holiday',
    SHORTENED = 'shortened',
}

@Entity('schedule_calendar_days')
export class CalendarDay {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'version_id' })
    versionId: number;

    @ManyToOne(() => ScheduleVersion, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'version_id' })
    version: ScheduleVersion;

    @Column({ type: 'date' })
    date: Date;

    @Column({ name: 'day_type', type: 'varchar', length: 20, default: DayType.WORKING })
    dayType: DayType;

    @Column({ name: 'max_lessons', type: 'int', nullable: true })
    maxLessons: number | null;

    @Column({ name: 'week_number', type: 'int', nullable: true })
    weekNumber: number | null;

    @Column({ type: 'text', nullable: true })
    note: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
