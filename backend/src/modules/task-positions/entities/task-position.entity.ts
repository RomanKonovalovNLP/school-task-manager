import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { UserSession } from '../../auth/entities/user-session.entity';

@Entity('task_positions')
@Unique(['taskId', 'userSessionId'])
export class TaskPosition {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ name: 'user_session_id' })
    userSessionId: number;

    @ManyToOne(() => UserSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_session_id' })
    userSession: UserSession;

    @Column({ type: 'int', name: 'position_x' })
    positionX: number;

    @Column({ type: 'int', name: 'position_y' })
    positionY: number;

    @Column({ type: 'int', default: 0, name: 'z_index' })
    zIndex: number;

    @Column({ type: 'int', nullable: true, name: 'group_id' })
    groupId: number | null;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}