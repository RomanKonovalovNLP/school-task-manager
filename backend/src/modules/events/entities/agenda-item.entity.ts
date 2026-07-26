import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { EventAttachment } from './event-attachment.entity';
import { EventTask } from './event-task.entity';

@Entity('agenda_items')
export class AgendaItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_id' })
    eventId: number;

    @ManyToOne(() => Event, (event) => event.agendaItems, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    // Время начала пункта (HH:MM)
    @Column({ name: 'start_time', type: 'time', nullable: true })
    startTime: string;

    // Время окончания пункта (HH:MM)
    @Column({ name: 'end_time', type: 'time', nullable: true })
    endTime: string;

    // Порядок сортировки
    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;

    // Ответственные (JSON массив имён)
    @Column({ name: 'responsible_names', type: 'jsonb', nullable: true })
    responsibleNames: string[];

    // Вложения привязываются через agendaItemId в EventAttachment
    @OneToMany(() => EventAttachment, (attachment) => attachment.agendaItem, { cascade: true })
    attachments: EventAttachment[];

    // Задачи привязываются через agendaItemId в EventTask
    @OneToMany(() => EventTask, (task) => task.agendaItem, { cascade: true })
    tasks: EventTask[];

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
