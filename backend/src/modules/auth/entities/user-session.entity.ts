import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('user_sessions')
export class UserSession {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255, name: 'full_name' })
    fullName: string;

    @Column({ type: 'varchar', length: 255, unique: true, name: 'session_token' })
    sessionToken: string;

    @Column({ type: 'boolean', default: false, name: 'is_admin' })
    isAdmin: boolean;

    @Column({
        type: 'timestamp',
        name: 'last_active',
        default: () => 'CURRENT_TIMESTAMP',
    })
    lastActive: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}