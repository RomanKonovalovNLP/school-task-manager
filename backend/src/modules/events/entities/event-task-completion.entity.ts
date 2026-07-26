import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique,
} from 'typeorm';
import { EventTask } from './event-task.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';

@Entity('event_task_completions')
@Unique(['eventTaskId', 'userProfileId'])
export class EventTaskCompletion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_task_id' })
    eventTaskId: number;

    @ManyToOne(() => EventTask, (task) => task.completions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_task_id' })
    eventTask: EventTask;

    @Column({ name: 'user_profile_id' })
    userProfileId: number;

    @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_profile_id' })
    userProfile: UserProfile;

    @CreateDateColumn({ name: 'completed_at', type: 'timestamptz' })
    completedAt: Date;
}
