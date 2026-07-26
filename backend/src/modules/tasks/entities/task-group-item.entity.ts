import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { TaskGroup } from './task-group.entity';
import { Task } from './task.entity';

/** Членство задачи в персональной группе. */
@Entity('task_group_items')
@Unique(['groupId', 'taskId'])
export class TaskGroupItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'group_id' })
    groupId: number;

    @ManyToOne(() => TaskGroup, (group) => group.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'group_id' })
    group: TaskGroup;

    @Column({ name: 'task_id' })
    taskId: number;

    // Удаление задачи автоматически убирает её из групп
    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;
}
