import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('event_assignees')
export class EventAssignee {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_id' })
    eventId: number;

    @ManyToOne(() => Event, (event) => event.assignees, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ name: 'assignee_category', length: 100 })
    assigneeCategory: string;
}
