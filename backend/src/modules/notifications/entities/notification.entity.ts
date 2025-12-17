import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Task } from '../../tasks/entities/task.entity';

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @Column({ name: 'recipient_category', length: 100, nullable: true })
    recipientCategory: string;

    @Column({ name: 'task_id', nullable: true })
    taskId: number | null;

    @Column({
        name: 'notification_type',
        length: 50,
        comment: 'new_task, deadline_changed, task_deleted, task_assigned',
    })
    notificationType: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'task_id' })
    task: Task;
}