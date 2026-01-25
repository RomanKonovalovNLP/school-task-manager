import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { TaskAssignee } from './task-assignee.entity';
import { TaskView } from './task-view.entity';
import { TaskAttachment } from './task-attachment.entity';

@Entity('tasks')
export class Task {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 255, name: 'creator_name' })
    creatorName: string;

    @Column({ type: 'timestamp' })
    deadline: Date;

    @Column({ type: 'boolean', default: false, name: 'is_overdue' })
    isOverdue: boolean;

    @Column({ name: 'creator_id', nullable: true })
    creatorId: number;

    @OneToMany(() => TaskAssignee, (assignee) => assignee.task, {
        cascade: true,
        eager: true,
    })
    assignees: TaskAssignee[];

    @OneToMany(() => TaskView, (view) => view.task, { cascade: true })
    views: TaskView[];

    // НОВОЕ: Связь с вложениями
    @OneToMany(() => TaskAttachment, (attachment) => attachment.task, { cascade: true })
    attachments: TaskAttachment[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
