import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';
import { Workload } from './workload.entity';
import { Room } from './room.entity';
import { Substitution } from './substitution.entity';
import { WorkloadWeekType } from './enums';

@Entity('schedule_lessons')
@Index(['versionId', 'dayOfWeek', 'lessonNumber', 'weekType'])
export class ScheduleLesson {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'version_id' })
    versionId: number;

    @ManyToOne(() => ScheduleVersion, (version) => version.lessons, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'version_id' })
    version: ScheduleVersion;

    @Column({ name: 'workload_id' })
    workloadId: number;

    @ManyToOne(() => Workload, (workload) => workload.lessons, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'workload_id' })
    workload: Workload;

    // День недели (1 = Понедельник, 7 = Воскресенье)
    @Column({ name: 'day_of_week', type: 'int' })
    dayOfWeek: number;

    // Номер урока (1-8)
    @Column({ name: 'lesson_number', type: 'int' })
    lessonNumber: number;

    // Тип недели (для двухнедельного расписания)
    @Column({
        name: 'week_type',
        type: 'enum',
        enum: WorkloadWeekType,
        default: WorkloadWeekType.BOTH,
    })
    weekType: WorkloadWeekType;

    // Кабинет (может отличаться от указанного в workload)
    @Column({ name: 'room_id', nullable: true })
    roomId: number;

    @ManyToOne(() => Room, (room) => room.lessons, { nullable: true })
    @JoinColumn({ name: 'room_id' })
    room: Room;

    // Заблокирован для автоматического изменения
    @Column({ name: 'is_locked', type: 'boolean', default: false })
    isLocked: boolean;

    // Замены для этого урока
    @OneToMany(() => Substitution, (sub) => sub.lesson)
    substitutions: Substitution[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
