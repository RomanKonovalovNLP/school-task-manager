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

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'timestamp', nullable: true })
    deadline: Date | null;

    @Column({ name: 'creator_name', length: 255 })
    creatorName: string;

    @Column({ name: 'is_completed', default: false })
    isCompleted: boolean;

    @Column({ name: 'completed_by', length: 255, nullable: true })
    completedBy: string;

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @OneToMany(() => EventTaskCompletion, (completion) => completion.eventTask, { cascade: true })
    completions: EventTaskCompletion[];
}
