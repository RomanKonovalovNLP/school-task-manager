import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Index,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { TaskAssignee } from './task-assignee.entity';
import { TaskView } from './task-view.entity';
import { TaskAttachment } from './task-attachment.entity';

@Entity('tasks')
@Index(['schoolId', 'deadline'])
@Index(['creatorName'])
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

    @Column({ type: 'timestamptz' })
    deadline: Date;

    @Column({ type: 'boolean', default: false, name: 'is_overdue' })
    isOverdue: boolean;

    @Column({ name: 'creator_id', nullable: true })
    creatorId: number;

    // FIX #2: Личная задача — видна только создателю
    @Column({ name: 'is_personal', type: 'boolean', default: false })
    isPersonal: boolean;

    // FIX #2: Видна только назначенным категориям + создателю + админам
    @Column({ name: 'category_only', type: 'boolean', default: false })
    categoryOnly: boolean;

    // Ограничение видимости вложений: если true — файлы, загруженные обычными
    // пользователями, видны только создателю задачи, админам и самому загрузившему.
    // Файлы, загруженные создателем/админом (шаблоны), видны всем.
    @Column({ name: 'restrict_attachments', type: 'boolean', default: false })
    restrictAttachments: boolean;

    // Ручной приоритет: пометка «важная» независимо от дедлайна
    @Column({ name: 'is_important', type: 'boolean', default: false })
    isImportant: boolean;

    // Повторяемость (индикатор серии): none/daily/weekly/monthly
    @Column({ name: 'recurrence', type: 'varchar', length: 20, nullable: true })
    recurrence: string;

    // Флаги отправленных напоминаний до дедлайна
    @Column({ name: 'remind24_sent', type: 'boolean', default: false })
    remind24Sent: boolean;

    @Column({ name: 'remind1_sent', type: 'boolean', default: false })
    remind1Sent: boolean;

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

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
