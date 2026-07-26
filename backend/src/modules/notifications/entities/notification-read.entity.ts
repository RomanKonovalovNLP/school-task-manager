import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
    Index,
} from 'typeorm';
import { Notification } from './notification.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';

/**
 * ИСПРАВЛЕНО (#6): персональный статус уведомления.
 * Раньше isRead хранился в самом уведомлении (одном на категорию),
 * и «прочитал один — пропало у всех». Теперь прочтение и скрытие
 * («удаление» из своего списка) — на пользователя (по профилю,
 * т.к. профиль стабилен, в отличие от сессии).
 */
@Entity('notification_reads')
@Unique(['notificationId', 'userProfileId'])
@Index(['userProfileId'])
export class NotificationRead {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'notification_id' })
    notificationId: number;

    @Column({ name: 'user_profile_id' })
    userProfileId: number;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    // Пользователь «удалил» уведомление из своего списка
    @Column({ name: 'is_hidden', default: false })
    isHidden: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'notification_id' })
    notification: Notification;

    @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_profile_id' })
    userProfile: UserProfile;
}
