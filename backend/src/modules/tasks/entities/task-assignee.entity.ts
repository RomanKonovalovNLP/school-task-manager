import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_assignees')
@Unique(['taskId', 'assigneeCategory'])
@Index(['assigneeCategory'])
export class TaskAssignee {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    @ManyToOne(() => Task, (task) => task.assignees, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    // Назначение на категорию (одна из assignee_category / assignee_user заполнена)
    @Column({ type: 'varchar', length: 100, name: 'assignee_category', nullable: true })
    assigneeCategory: string;

    // Назначение на конкретного пользователя (ФИО)
    @Column({ type: 'varchar', length: 255, name: 'assignee_user', nullable: true })
    assigneeUser: string;
}
