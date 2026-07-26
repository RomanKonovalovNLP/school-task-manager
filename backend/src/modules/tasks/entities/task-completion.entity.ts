import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';

/**
 * ИСПРАВЛЕНО: Статус выполнения привязан к профилю пользователя (не сессии)
 * Теперь отметки о выполнении сохраняются между сессиями
 */
@Entity('task_completions')
@Unique(['taskId', 'userProfileId'])
export class TaskCompletion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    @Column({ name: 'user_profile_id' })
    userProfileId: number;

    @CreateDateColumn({ name: 'completed_at', type: 'timestamptz' })
    completedAt: Date;

    // Relations
    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_profile_id' })
    userProfile: UserProfile;
}
