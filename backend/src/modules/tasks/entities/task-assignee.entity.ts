import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_assignees')
@Unique(['taskId', 'assigneeCategory'])
export class TaskAssignee {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    @ManyToOne(() => Task, (task) => task.assignees, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'varchar', length: 100, name: 'assignee_category' })
    assigneeCategory: string;
}