import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';
import { TaskGroupItem } from './task-group-item.entity';

/**
 * Персональная группа задач пользователя (его собственная логика группировки).
 * Привязана к (schoolId, ownerName) — у каждого пользователя свои группы,
 * не влияют на других.
 */
@Entity('task_groups')
export class TaskGroup {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @Column({ name: 'owner_name', length: 255 })
    ownerName: string;

    @Column({ length: 255 })
    name: string;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @OneToMany(() => TaskGroupItem, (item) => item.group, { cascade: true })
    items: TaskGroupItem[];
}
