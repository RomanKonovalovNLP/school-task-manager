import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('task_statistics')
export class TaskStatistic {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @Column({ name: 'date', type: 'date' })
    date: Date;

    @Column({ name: 'total_tasks', default: 0 })
    totalTasks: number;

    @Column({ name: 'completed_tasks', default: 0 })
    completedTasks: number;

    @Column({ name: 'overdue_tasks', default: 0 })
    overdueTasks: number;

    @Column({ name: 'urgent_tasks', default: 0 })
    urgentTasks: number;

    @Column({ name: 'medium_priority_tasks', default: 0 })
    mediumPriorityTasks: number;

    @Column({ name: 'low_priority_tasks', default: 0 })
    lowPriorityTasks: number;

    @Column({ name: 'tasks_by_category', type: 'jsonb', nullable: true })
    tasksByCategory: Record<string, number>;

    @Column({ name: 'avg_completion_time', type: 'float', nullable: true })
    avgCompletionTime: number | null;  // ← ИСПРАВЛЕНО: добавлен | null

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}