import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { EventAssignee } from './event-assignee.entity';
import { EventAttachment } from './event-attachment.entity';
import { EventTask } from './event-task.entity';
import { AgendaItem } from './agenda-item.entity';

@Entity('events')
export class Event {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    // Место проведения (отдельный пункт, чтобы не писать в описании)
    @Column({ name: 'location', type: 'varchar', length: 255, nullable: true })
    location: string;

    // Повторяемость (индикатор серии): none/daily/weekly/monthly
    @Column({ name: 'recurrence', type: 'varchar', length: 20, nullable: true })
    recurrence: string;

    @Column({ name: 'start_date', type: 'timestamptz' })
    startDate: Date;

    @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
    endDate: Date | null;

    @Column({ name: 'all_day', default: false })
    allDay: boolean;

    @Column({ name: 'event_date', type: 'timestamptz', nullable: true })
    eventDate: Date | null;

    @Column({ name: 'creator_id' })
    creatorId: number;

    @Column({ name: 'creator_name', length: 255 })
    creatorName: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @OneToMany(() => EventAssignee, (assignee) => assignee.event, { cascade: true })
    assignees: EventAssignee[];

    @OneToMany(() => EventAttachment, (attachment) => attachment.event, { cascade: true })
    attachments: EventAttachment[];

    @OneToMany(() => EventTask, (task) => task.event, { cascade: true })
    tasks: EventTask[];

    // FIX #5: Расписание мероприятия
    @OneToMany(() => AgendaItem, (item) => item.event, { cascade: true })
    agendaItems: AgendaItem[];
}
