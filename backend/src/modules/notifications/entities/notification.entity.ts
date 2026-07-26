import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Event } from '../../events/entities/event.entity';

@Entity('notifications')
@Index(['schoolId', 'recipientCategory', 'isRead'])
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @Column({ name: 'recipient_category', length: 100, nullable: true })
    recipientCategory: string;

    // Адресат — конкретный пользователь (ФИО), альтернатива категории
    @Column({ name: 'recipient_user', length: 255, nullable: true })
    recipientUser: string;

    @Column({ name: 'task_id', nullable: true })
    taskId: number | null;

    // ✅ НОВОЕ: Связь с мероприятием
    @Column({ name: 'event_id', nullable: true })
    eventId: number | null;

    @Column({
        name: 'notification_type',
        length: 50,
        comment: 'new_task, deadline_changed, task_deleted, task_assigned, new_event, event_updated, event_date_changed',
    })
    notificationType: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    // ✅ ИСПРАВЛЕНИЕ: Используем timestamptz для корректного timezone
    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    // ✅ НОВОЕ: Связь с мероприятием
    @ManyToOne(() => Event, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'event_id' })
    event: Event;
}
