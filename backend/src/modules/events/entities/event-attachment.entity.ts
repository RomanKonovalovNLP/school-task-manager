import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('event_attachments')
export class EventAttachment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'event_id' })
    eventId: number;

    @ManyToOne(() => Event, (event) => event.attachments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ name: 'file_name', length: 255 })
    fileName: string;

    @Column({ name: 'original_name', length: 255 })
    originalName: string;

    @Column({ name: 'mime_type', length: 100 })
    mimeType: string;

    @Column({ name: 'file_size' })
    fileSize: number;

    @Column({ name: 'file_path', length: 500 })
    filePath: string;

    @Column({ name: 'uploader_name', length: 255 })
    uploaderName: string;

    @CreateDateColumn({ name: 'uploaded_at' })
    uploadedAt: Date;
}
