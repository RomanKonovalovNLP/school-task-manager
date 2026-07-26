import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification } from './entities/notification.entity';
import { NotificationRead } from './entities/notification-read.entity';
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

    // Еженедельная персональная сводка (понедельник, 6:00)
    WEEKLY_DIGEST = 'weekly_digest',
}

/**
 * ИСПРАВЛЕНО (#6): статус «прочитано»/«удалено» теперь хранится
 * на пользователя (таблица notification_reads), а не в самом уведомлении.
 * Раньше уведомление одно на категорию, и «прочитал один — пропало у всех».
 * Глобальный флаг notification.isRead оставлен для совместимости со старыми
 * данными: такие уведомления считаются прочитанными для всех.
 */
@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
        @InjectRepository(NotificationRead)
        private notificationReadsRepo: Repository<NotificationRead>,
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
                isAdmin: session.isAdmin,
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
     * Получить (или создать) профиль пользователя — якорь для
     * персонального статуса уведомлений.
     */
    private async getOrCreateProfile(schoolId: number, fullName: string): Promise<UserProfile> {
        let profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });
        if (!profile) {
            profile = await this.userProfileRepo.save(
                this.userProfileRepo.create({ schoolId, fullName }),
            );
        }
        return profile;
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
        // null — когда мероприятие уже удалено (иначе уведомление уйдёт каскадом вместе с ним)
        eventId: number | null,
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
     * Базовый запрос: уведомления школы по категориям пользователя.
     */
    private baseQuery(schoolId: number, categories: string[], fullName: string) {
        const qb = this.notificationsRepo
            .createQueryBuilder('notification')
            .where('notification.schoolId = :schoolId', { schoolId });
        if (categories && categories.length > 0) {
            qb.andWhere(
                '(notification.recipientCategory IN (:...categories) OR notification.recipientUser = :fullName)',
                { categories, fullName },
            );
        } else {
            qb.andWhere('notification.recipientUser = :fullName', { fullName });
        }
        return qb;
    }

    /** Уведомление о мероприятии для конкретных пользователей (по ФИО). */
    async createUserEventNotification(
        schoolId: number,
        recipientUsers: string[],
        // null — когда мероприятие уже удалено
        eventId: number | null,
        type: NotificationType,
        message: string,
    ) {
        const notifications = recipientUsers.map((u) =>
            this.notificationsRepo.create({
                schoolId,
                recipientUser: u,
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
     * Убирает из списка персональных адресатов тех, кто уже получит уведомление
     * по назначенной категории — чтобы не приходило два уведомления одному человеку.
     */
    async filterUncoveredUsers(schoolId: number, users: string[], categories: string[]): Promise<string[]> {
        if (!users || users.length === 0 || !categories || categories.length === 0) return users || [];
        const profiles = await this.userProfileRepo.find({ where: { schoolId, fullName: In(users) } });
        if (profiles.length === 0) return users;
        const idToName = new Map(profiles.map((p) => [p.id, p.fullName]));
        const rows = await this.userCategoryRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.category', 'cat')
            .where('cat.schoolId = :schoolId', { schoolId })
            .andWhere('cat.categoryName IN (:...categories)', { categories })
            .andWhere('uc.userProfileId IN (:...ids)', { ids: profiles.map((p) => p.id) })
            .select('uc.userProfileId', 'userProfileId')
            .getRawMany();
        const coveredNames = new Set(
            rows.map((r) => idToName.get(Number(r.userProfileId))).filter(Boolean),
        );
        return users.filter((u) => !coveredNames.has(u));
    }

    /** Уведомление для конкретных пользователей (по ФИО). */
    async createUserNotification(
        schoolId: number,
        recipientUsers: string[],
        taskId: number | null,
        type: NotificationType,
        message: string,
    ) {
        const notifications = recipientUsers.map((u) =>
            this.notificationsRepo.create({
                schoolId,
                recipientUser: u,
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
     * Получение непрочитанных уведомлений для пользователя
     */
    async getUnreadNotifications(
        schoolId: number,
        fullName: string,
        userCategories: string[],
    ) {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });
        if (!profile) return [];

        const notifications = await this.baseQuery(schoolId, userCategories, fullName)
            // Старые данные: глобально прочитанные считаем прочитанными
            .andWhere('notification.isRead = false')
            // Не прочитано и не скрыто этим пользователем
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r
                    WHERE r.notification_id = notification.id
                      AND r.user_profile_id = :profileId
                      AND (r.is_read = true OR r.is_hidden = true)
                )`,
                { profileId: profile.id },
            )
            .orderBy('notification.createdAt', 'DESC')
            .limit(50)
            .getMany();

        // Преобразуем даты в ISO строки для корректной передачи
        return notifications.map(n => ({
            ...n,
            isRead: false,
            createdAt: n.createdAt.toISOString(),
        }));
    }

    /**
     * Получение всех уведомлений для пользователя (включая прочитанные)
     */
    async getAllNotifications(
        schoolId: number,
        fullName: string,
        userCategories: string[],
        limit: number = 100,
    ) {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });

        const qb = this.baseQuery(schoolId, userCategories, fullName)
            .orderBy('notification.createdAt', 'DESC')
            .limit(limit);

        // Скрытые («удалённые») этим пользователем не показываем
        if (profile) {
            qb.andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r
                    WHERE r.notification_id = notification.id
                      AND r.user_profile_id = :profileId
                      AND r.is_hidden = true
                )`,
                { profileId: profile.id },
            );
        }

        const notifications = await qb.getMany();

        // Персональный статус прочтения
        let readIds = new Set<number>();
        if (profile && notifications.length) {
            const reads = await this.notificationReadsRepo.find({
                where: {
                    userProfileId: profile.id,
                    notificationId: In(notifications.map((n) => n.id)),
                    isRead: true,
                },
            });
            readIds = new Set(reads.map((r) => r.notificationId));
        }

        return notifications.map(n => ({
            ...n,
            isRead: n.isRead || readIds.has(n.id),
            createdAt: n.createdAt.toISOString(),
        }));
    }

    /**
     * Уведомления для колокольчика при подключении:
     * все непрочитанные + прочитанные за последние N часов.
     *
     * Раньше отдавались только непрочитанные, поэтому после перезагрузки страницы
     * прочитанное исчезало из списка и пользователь мог потерять важное из виду.
     */
    async getRecentNotifications(
        schoolId: number,
        fullName: string,
        userCategories: string[],
        hours: number = 24,
        limit: number = 50,
    ) {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });
        if (!profile) return [];

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const notifications = await this.baseQuery(schoolId, userCategories, fullName)
            // Скрытые («удалённые») пользователем не показываем
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r
                    WHERE r.notification_id = notification.id
                      AND r.user_profile_id = :profileId
                      AND r.is_hidden = true
                )`,
            )
            .andWhere(
                new Brackets((qb) => {
                    // Непрочитанные
                    qb.where(
                        `notification.isRead = false AND NOT EXISTS (
                            SELECT 1 FROM notification_reads r2
                            WHERE r2.notification_id = notification.id
                              AND r2.user_profile_id = :profileId
                              AND r2.is_read = true
                        )`,
                    )
                        // Прочитанные недавно — оставляем в списке ещё N часов
                        .orWhere(
                            `EXISTS (
                            SELECT 1 FROM notification_reads r3
                            WHERE r3.notification_id = notification.id
                              AND r3.user_profile_id = :profileId
                              AND r3.is_read = true
                              AND r3.updated_at >= :since
                        )`,
                        )
                        // Старые данные: глобально прочитанные, но свежие по времени создания
                        .orWhere('(notification.isRead = true AND notification.createdAt >= :since)');
                }),
            )
            .setParameter('profileId', profile.id)
            .setParameter('since', since)
            .orderBy('notification.createdAt', 'DESC')
            .limit(limit)
            .getMany();

        // Персональный статус прочтения
        let readIds = new Set<number>();
        if (notifications.length) {
            const reads = await this.notificationReadsRepo.find({
                where: {
                    userProfileId: profile.id,
                    notificationId: In(notifications.map((n) => n.id)),
                    isRead: true,
                },
            });
            readIds = new Set(reads.map((r) => r.notificationId));
        }

        return notifications.map((n) => ({
            ...n,
            isRead: n.isRead || readIds.has(n.id),
            createdAt: n.createdAt.toISOString(),
        }));
    }

    /**
     * Отметка уведомления как прочитанного (для текущего пользователя)
     */
    async markAsRead(
        notificationId: number,
        schoolId: number,
        fullName: string,
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

        const okCat = notification.recipientCategory && userCategories?.includes(notification.recipientCategory);
        const okUser = (notification as any).recipientUser && (notification as any).recipientUser === fullName;
        const targeted = !!notification.recipientCategory || !!(notification as any).recipientUser;
        if (targeted && !okCat && !okUser) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        const profile = await this.getOrCreateProfile(schoolId, fullName);
        await this.notificationReadsRepo.upsert(
            { notificationId, userProfileId: profile.id, isRead: true },
            ['notificationId', 'userProfileId'],
        );

        return { success: true };
    }

    /**
     * Отметка всех уведомлений как прочитанных (для текущего пользователя)
     */
    async markAllAsRead(schoolId: number, fullName: string, categories: string[]) {
        const profile = await this.getOrCreateProfile(schoolId, fullName);

        const unread = await this.baseQuery(schoolId, categories, fullName)
            .andWhere('notification.isRead = false')
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r
                    WHERE r.notification_id = notification.id
                      AND r.user_profile_id = :profileId
                      AND (r.is_read = true OR r.is_hidden = true)
                )`,
                { profileId: profile.id },
            )
            .getMany();

        if (unread.length) {
            await this.notificationReadsRepo.upsert(
                unread.map((n) => ({
                    notificationId: n.id,
                    userProfileId: profile.id,
                    isRead: true,
                })),
                ['notificationId', 'userProfileId'],
            );
        }

        return { success: true, updated: unread.length };
    }

    /**
     * Cron: ежедневная очистка старых уведомлений (старше 30 дней)
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async scheduledCleanup() {
        return this.cleanupOldNotifications(30);
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
    async getUnreadCount(schoolId: number, fullName: string, categories: string[]) {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });
        if (!profile) return 0;

        return this.baseQuery(schoolId, categories, fullName)
            .andWhere('notification.isRead = false')
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r
                    WHERE r.notification_id = notification.id
                      AND r.user_profile_id = :profileId
                      AND (r.is_read = true OR r.is_hidden = true)
                )`,
                { profileId: profile.id },
            )
            .getCount();
    }

    /**
     * Удалить уведомление (скрыть у текущего пользователя).
     * ИСПРАВЛЕНО (#6): раньше строка удалялась целиком —
     * уведомление пропадало у всех пользователей категории.
     */
    async deleteNotification(
        notificationId: number,
        schoolId: number,
        fullName: string,
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

        const profile = await this.getOrCreateProfile(schoolId, fullName);
        await this.notificationReadsRepo.upsert(
            { notificationId, userProfileId: profile.id, isHidden: true },
            ['notificationId', 'userProfileId'],
        );

        return { success: true };
    }

    /**
     * Удалить (скрыть) все прочитанные уведомления пользователя
     */
    async deleteReadNotificationsForUser(schoolId: number, fullName: string, categories: string[]) {
        const profile = await this.getOrCreateProfile(schoolId, fullName);

        // Прочитанные (глобально — старые данные, или лично) и ещё не скрытые
        const readNotHidden = await this.baseQuery(schoolId, categories, fullName)
            .andWhere(
                new Brackets((qb) => {
                    qb.where('notification.isRead = true').orWhere(
                        `EXISTS (
                            SELECT 1 FROM notification_reads r
                            WHERE r.notification_id = notification.id
                              AND r.user_profile_id = :profileId
                              AND r.is_read = true
                        )`,
                    );
                }),
            )
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM notification_reads r2
                    WHERE r2.notification_id = notification.id
                      AND r2.user_profile_id = :profileId
                      AND r2.is_hidden = true
                )`,
            )
            .setParameter('profileId', profile.id)
            .getMany();

        if (readNotHidden.length) {
            await this.notificationReadsRepo.upsert(
                readNotHidden.map((n) => ({
                    notificationId: n.id,
                    userProfileId: profile.id,
                    isHidden: true,
                })),
                ['notificationId', 'userProfileId'],
            );
        }

        return { success: true, deleted: readNotHidden.length };
    }

    /**
     * Удалить все уведомления для категорий (старый метод, оставлен для совместимости)
     * @deprecated Use deleteReadNotificationsForUser instead
     */
    async deleteAllForCategories(schoolId: number, fullName: string, categories: string[]) {
        return this.deleteReadNotificationsForUser(schoolId, fullName, categories);
    }
}
