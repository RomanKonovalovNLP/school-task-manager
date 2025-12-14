import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
    Unique,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

@Entity('admins')
@Unique(['schoolId', 'fullName'])
export class Admin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, (school) => school.admins, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255, name: 'full_name' })
    fullName: string;

    @Column({ type: 'varchar', length: 255, name: 'password_hash' })
    passwordHash: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}