import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_views')
@Unique(['taskId', 'viewerName'])
export class TaskView {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    @ManyToOne(() => Task, (task) => task.views, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'varchar', length: 255, name: 'viewer_name' })
    viewerName: string;

    @CreateDateColumn({ name: 'viewed_at', type: 'timestamptz' })
    viewedAt: Date;
}