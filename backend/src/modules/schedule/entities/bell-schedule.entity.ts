import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';

@Entity('bell_schedules')
export class BellSchedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'version_id' })
    versionId: number;

    @ManyToOne(() => ScheduleVersion, (version) => version.bellSchedule, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'version_id' })
    version: ScheduleVersion;

    // Номер урока (1-8)
    @Column({ name: 'lesson_number', type: 'int' })
    lessonNumber: number;

    // Время начала урока (HH:MM)
    @Column({ name: 'start_time', type: 'time' })
    startTime: string;

    // Время окончания урока (HH:MM)
    @Column({ name: 'end_time', type: 'time' })
    endTime: string;

    // Продолжительность перемены после этого урока (минуты)
    @Column({ name: 'break_after', type: 'int', default: 10 })
    breakAfter: number;

    // Название (опционально, например "Большая перемена")
    @Column({ type: 'varchar', length: 100, nullable: true })
    name: string;
}
