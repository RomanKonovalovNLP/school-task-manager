import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserSession } from '../auth/entities/user-session.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';

export enum NotificationType {
    // Задачи
    NEW_TASK = 'new_task',
    DEADLINE_CHANGED = 'deadline_changed',
    TASK_EDITED = 'task_edited',
    TASK_DELETED = 'task_deleted',
    TASK_ASSIGNED = 'task_assigned',
    
    // Мероприятия
    NEW_EVENT = 'new_event',
    EVENT_UPDATED = 'event_updated',
    EVENT_DATE_CHANGED = 'event_date_changed',
    EVENT_DELETED = 'event_deleted',
}

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
        @InjectRepository(UserSession)
        private userSessionsRepo: Repository<UserSession>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
        @InjectRepository(UserCategory)
        private userCategoryRepo: Repository<UserCategory>,
    ) { }

    /**
     * Валидация токена пользователя для WebSocket
     * ИСПРАВЛЕНО: Добавлена проверка существования сессии в БД
     */
    async validateUserToken(token: string) {
        try {
            const cleanToken = token.replace('Bearer ', '').trim();

            // Проверяем существование сессии в БД
            const session = await this.userSessionsRepo.findOne({
                where: { sessionToken: cleanToken },
            });

            if (!session) return null;

            // Проверяем что сессия не истекла (lastActive не старше 24 часов)
            const sessionAge = Date.now() - new Date(session.lastActive).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 часа
            if (sessionAge > maxAge) {
                return null;
            }

            const categories = await this.getUserCategoriesByProfile(
                session.schoolId,
                session.fullName,
            );

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
     * Получить категории пользователя по профилю
     */
    private async getUserCategoriesByProfile(
        schoolId: number,
        fullName: string,
    ): Promise<string[]> {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });

        if (!profile) {
            return [];
        }

        const userCategories = await this.userCategoryRepo.find({
            where: { userProfileId: profile.id },
            relations: ['category'],
        });

        return userCategories.map((uc) => uc.category.categoryName);
    }

    /**
     * Создание уведомления для задачи
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
                eventId: null,
                notificationType: type,
                message,
                isRead: false,
            }),
        );

        return this.notificationsRepo.save(notifications);
    }

    /**
     * Создание уведомления для мероприятия
     */
    async createEventNotification(
        schoolId: number,
        recipientCategories: string[],
        eventId: number,
        type: NotificationType,
        message: string,
    ) {
        const notifications = recipientCategories.map((category) =>
            this.notificationsRepo.create({
                schoolId,
                recipientCategory: category,
                taskId: null,
                eventId,
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

        const notifications = await this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId })
            .andWhere('notification.recipientCategory IN (:...categories)', {
                categories: userCategories,
            })
            .andWhere('notification.isRead = false')
            .orderBy('notification.createdAt', 'DESC')
            .limit(50)
            .getMany();

        // Преобразуем даты в ISO строки для корректной передачи
        return notifications.map(n => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
        }));
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

        const notifications = await this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId })
            .andWhere('notification.recipientCategory IN (:...categories)', {
                categories: userCategories,
            })
            .orderBy('notification.createdAt', 'DESC')
            .limit(limit)
            .getMany();

        // Преобразуем даты в ISO строки
        return notifications.map(n => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
        }));
    }

    /**
     * Отметка уведомления как прочитанного
     * ИСПРАВЛЕНО: Добавлена проверка принадлежности (опциональная)
     */
    async markAsRead(
        notificationId: number,
        userId: number,
        schoolId?: number,
        userCategories?: string[],
    ) {
        const notification = await this.notificationsRepo.findOne({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new ForbiddenException('Уведомление не найдено');
        }

        // Проверяем принадлежность только если переданы параметры
        if (schoolId !== undefined && notification.schoolId !== schoolId) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        if (userCategories && userCategories.length > 0 && notification.recipientCategory) {
            if (!userCategories.includes(notification.recipientCategory)) {
                throw new ForbiddenException('Нет доступа к этому уведомлению');
            }
        }

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
     * ИСПРАВЛЕНО: Добавлена проверка принадлежности
     */
    async deleteNotification(
        notificationId: number,
        schoolId: number,
        userCategories: string[],
    ) {
        const notification = await this.notificationsRepo.findOne({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new ForbiddenException('Уведомление не найдено');
        }

        if (notification.schoolId !== schoolId) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        if (notification.recipientCategory && !userCategories.includes(notification.recipientCategory)) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        await this.notificationsRepo.delete({ id: notificationId });
        return { success: true };
    }

    /**
     * Удалить все прочитанные уведомления пользователя
     */
    async deleteReadNotificationsForUser(schoolId: number, categories: string[]) {
        if (!categories || categories.length === 0) {
            return { success: true, deleted: 0 };
        }

        const result = await this.notificationsRepo
            .createQueryBuilder()
            .delete()
            .where('schoolId = :schoolId', { schoolId })
            .andWhere('recipientCategory IN (:...categories)', { categories })
            .andWhere('isRead = true')
            .execute();

        return { success: true, deleted: result.affected || 0 };
    }

    /**
     * Удалить все уведомления для категорий (старый метод, оставлен для совместимости)
     * @deprecated Use deleteReadNotificationsForUser instead
     */
    async deleteAllForCategories(schoolId: number, categories: string[]) {
        return this.deleteReadNotificationsForUser(schoolId, categories);
    }
}
