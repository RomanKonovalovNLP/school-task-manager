import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';

/**
 * Профиль пользователя - хранит данные независимо от сессии
 * Связь: schoolId + fullName (уникальная комбинация)
 */
@Entity('user_profiles')
@Unique(['schoolId', 'fullName'])
export class UserProfile {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255, name: 'full_name' })
    fullName: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
