import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { UserSession } from '../../auth/entities/user-session.entity';

@Entity('task_groups')
export class TaskGroup {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ name: 'user_session_id' })
    userSessionId: number;

    @ManyToOne(() => UserSession, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_session_id' })
    userSession: UserSession;

    @Column({ type: 'int', name: 'position_x' })
    positionX: number;

    @Column({ type: 'int', name: 'position_y' })
    positionY: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}