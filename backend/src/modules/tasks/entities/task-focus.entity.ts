import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique,
    Index,
} from 'typeorm';
import { Task } from './task.entity';

/**
 * Режим «Сегодня» (фокус-план пользователя на день).
 *
 * Каждая строка — задача, которую пользователь ВРУЧНУЮ добавил в свой план на дату focusDate.
 * Срочные задачи (просроченные и с дедлайном сегодня) попадают в план автоматически
 * и в этой таблице не хранятся — их нельзя убрать из плана.
 */
@Entity('task_focus')
@Unique(['schoolId', 'ownerName', 'taskId', 'focusDate'])
@Index(['schoolId', 'ownerName', 'focusDate'])
export class TaskFocus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    // ФИО владельца плана (по аналогии с TaskGroup.ownerName)
    @Column({ name: 'owner_name', length: 255 })
    ownerName: string;

    @Column({ name: 'task_id' })
    taskId: number;

    // Дата плана в формате YYYY-MM-DD (локальная дата, без времени)
    @Column({ name: 'focus_date', type: 'date' })
    focusDate: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @ManyToOne(() => Task, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;
}
