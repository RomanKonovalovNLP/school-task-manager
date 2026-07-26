import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Event } from './event.entity';
import { AgendaItem } from './agenda-item.entity';
import { EventTaskCompletion } from './event-task-completion.entity';

@Entity('event_tasks')
export class EventTask {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_id' })
    eventId: number;

    @ManyToOne(() => Event, (event) => event.tasks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    // FIX #5: Привязка к пункту расписания (null = задача самого мероприятия)
    @Column({ name: 'agenda_item_id', nullable: true })
    agendaItemId: number;

    @ManyToOne(() => AgendaItem, (item) => item.tasks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'agenda_item_id' })
    agendaItem: AgendaItem;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'timestamptz', nullable: true })
    deadline: Date | null;

    @Column({ name: 'creator_name', length: 255 })
    creatorName: string;

    @Column({ name: 'is_completed', default: false })
    isCompleted: boolean;

    @Column({ name: 'completed_by', length: 255, nullable: true })
    completedBy: string;

    @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
    completedAt: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @OneToMany(() => EventTaskCompletion, (completion) => completion.eventTask, { cascade: true })
    completions: EventTaskCompletion[];
}
