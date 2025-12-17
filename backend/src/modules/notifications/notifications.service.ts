import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserSession } from '../auth/entities/user-session.entity';

export enum NotificationType {
    NEW_TASK = 'new_task',
    DEADLINE_CHANGED = 'deadline_changed',
    TASK_DELETED = 'task_deleted',
    TASK_ASSIGNED = 'task_assigned',
}

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
        @InjectRepository(UserSession)
        private userSessionsRepo: Repository<UserSession>,
    ) { }

    /**
     * Валидация токена пользователя для WebSocket
     */
    async validateUserToken(token: string) {
        try {
            // Убираем Bearer если есть
            const cleanToken = token.replace('Bearer ', '').trim();

            // Ищем сессию по токену
            const session = await this.userSessionsRepo.findOne({
                where: { sessionToken: cleanToken },
            });

            if (!session) return null;

            // Получаем категории пользователя
            // TODO: В будущем можно добавить отдельную таблицу для категорий пользователей
            // Пока используем дефолтные категории из контекста пользователя
            const categories = await this.getUserCategories(session.id, session.schoolId);

            return {
                id: session.id,
                schoolId: session.schoolId,
                fullName: session.fullName,
                categories: categories || [],
            };
        } catch (error) {
            console.error('Token validation error:', error);
            return null;
        }
    }

    /**
     * Получить категории пользователя
     * TODO: Реализовать получение категорий из базы данных
     */
    private async getUserCategories(
        userId: number,
        schoolId: number,
    ): Promise<string[]> {
        // Временная заглушка - возвращаем все категории
        // В реальности нужно получать из таблицы user_categories или similar
        return ['Учителя', 'Администрация']; // дефолтные категории
    }

    /**
     * Создание уведомления
     */
    async createNotification(
        schoolId: number,
        recipientCategories: string[],
        taskId: number | null,
        type: NotificationType,
        message: string,
    ) {
        const notifications = recipientCategories.map((category) =>
            this.notificationsRepo.create({
                schoolId,
                recipientCategory: category,
                taskId,
                notificationType: type,
                message,
                isRead: false,
            }),
        );

        return this.notificationsRepo.save(notifications);
    }

    /**
     * Получение непрочитанных уведомлений для пользователя
     */
    async getUnreadNotifications(
        userId: number,
        schoolId: number,
        userCategories: string[],
    ) {
        if (!userCategories || userCategories.length === 0) {
            return [];
        }

        return this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId })
            .andWhere('notification.recipientCategory IN (:...categories)', {
                categories: userCategories,
            })
            .andWhere('notification.isRead = false')
            .orderBy('notification.createdAt', 'DESC')
            .limit(50)
            .getMany();
    }

    /**
     * Получение всех уведомлений для пользователя (включая прочитанные)
     */
    async getAllNotifications(
        userId: number,
        schoolId: number,
        userCategories: string[],
        limit: number = 100,
    ) {
        if (!userCategories || userCategories.length === 0) {
            return [];
        }

        return this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId })
            .andWhere('notification.recipientCategory IN (:...categories)', {
                categories: userCategories,
            })
            .orderBy('notification.createdAt', 'DESC')
            .limit(limit)
            .getMany();
    }

    /**
     * Отметка уведомления как прочитанного
     */
    async markAsRead(notificationId: number, userId: number) {
        await this.notificationsRepo.update(
            { id: notificationId },
            { isRead: true },
        );

        return { success: true };
    }

    /**
     * Отметка всех уведомлений как прочитанных
     */
    async markAllAsRead(userId: number, schoolId: number, categories: string[]) {
        if (!categories || categories.length === 0) {
            return { success: true, updated: 0 };
        }

        const result = await this.notificationsRepo
            .createQueryBuilder()
            .update()
            .set({ isRead: true })
            .where('schoolId = :schoolId', { schoolId })
            .andWhere('recipientCategory IN (:...categories)', { categories })
            .andWhere('isRead = false')
            .execute();

        return { success: true, updated: result.affected || 0 };
    }

    /**
     * Удаление старых уведомлений (старше 30 дней)
     * Рекомендуется запускать через Cron
     */
    async cleanupOldNotifications(daysOld: number = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.notificationsRepo
            .createQueryBuilder()
            .delete()
            .where('createdAt < :date', { date: cutoffDate })
            .execute();

        return {
            success: true,
            deleted: result.affected || 0,
            message: `Deleted notifications older than ${daysOld} days`,
        };
    }

    /**
     * Получить количество непрочитанных уведомлений
     */
    async getUnreadCount(userId: number, schoolId: number, categories: string[]) {
        if (!categories || categories.length === 0) {
            return 0;
        }

        return this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId })
            .andWhere('notification.recipientCategory IN (:...categories)', {
                categories,
            })
            .andWhere('notification.isRead = false')
            .getCount();
    }

    /**
     * Удалить уведомление
     */
    async deleteNotification(notificationId: number) {
        await this.notificationsRepo.delete({ id: notificationId });
        return { success: true };
    }

    /**
     * Удалить все уведомления для категорий
     */
    async deleteAllForCategories(schoolId: number, categories: string[]) {
        const result = await this.notificationsRepo
            .createQueryBuilder()
            .delete()
            .where('schoolId = :schoolId', { schoolId })
            .andWhere('recipientCategory IN (:...categories)', { categories })
            .execute();

        return { success: true, deleted: result.affected || 0 };
    }
}