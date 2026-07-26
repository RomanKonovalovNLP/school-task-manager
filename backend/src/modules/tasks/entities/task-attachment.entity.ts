import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_attachments')
export class TaskAttachment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'task_id' })
    taskId: number;

    // Обратная связь с Task
    @ManyToOne(() => Task, (task) => task.attachments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column({ type: 'varchar', length: 255, name: 'file_name' })
    fileName: string;

    @Column({ type: 'varchar', length: 255, name: 'original_name' })
    originalName: string;

    @Column({ type: 'varchar', length: 100, name: 'mime_type' })
    mimeType: string;

    @Column({ name: 'file_size' })
    fileSize: number;

    @Column({ type: 'varchar', length: 255, name: 'uploader_name' })
    uploaderName: string;

    // true, если файл загружен создателем задачи или администратором.
    // Такие файлы (шаблоны) видны всем, даже при включённом restrictAttachments.
    @Column({ name: 'uploader_is_privileged', type: 'boolean', default: false })
    uploaderIsPrivileged: boolean;

    @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
    uploadedAt: Date;
}
