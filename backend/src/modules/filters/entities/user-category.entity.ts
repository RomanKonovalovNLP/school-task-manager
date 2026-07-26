import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique,
} from 'typeorm';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { FilterCategory } from './filter-category.entity';

/**
 * ИСПРАВЛЕНО: Связь категорий с профилем пользователя (не сессией)
 * Теперь категории сохраняются между сессиями
 */
@Entity('user_categories')
@Unique(['userProfileId', 'categoryId'])
export class UserCategory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_profile_id' })
    userProfileId: number;

    @Column({ name: 'category_id' })
    categoryId: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    // Relations
    @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_profile_id' })
    userProfile: UserProfile;

    @ManyToOne(() => FilterCategory, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'category_id' })
    category: FilterCategory;
}
