import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('super_admins')
export class SuperAdmin {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true, length: 100 })
    username: string;

    @Column({ name: 'password_hash' })
    passwordHash: string;

    @Column({ nullable: true })
    email: string;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
    lastLogin: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
