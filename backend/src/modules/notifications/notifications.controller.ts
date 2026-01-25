import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    Query,
    ParseIntPipe,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { Notification } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(SchoolAuthGuard)
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
        @InjectRepository(UserCategory)
        private userCategoryRepo: Repository<UserCategory>,
        @InjectRepository(Notification)
        private notificationsRepo: Repository<Notification>,
    ) { }

    /**
     * Получить категории пользователя по профилю
     */
    private async getUserCategories(schoolId: number, fullName: string): Promise<string[]> {
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
     * ИСПРАВЛЕНО: Проверка, принадлежит ли уведомление пользователю
     */
    private async checkNotificationOwnership(
        notificationId: number,
        schoolId: number,
        userCategories: string[],
    ): Promise<Notification> {
        const notification = await this.notificationsRepo.findOne({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new ForbiddenException('Уведомление не найдено');
        }

        // Проверяем что уведомление принадлежит той же школе
        if (notification.schoolId !== schoolId) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        // Проверяем что уведомление адресовано одной из категорий пользователя
        if (notification.recipientCategory && !userCategories.includes(notification.recipientCategory)) {
            throw new ForbiddenException('Нет доступа к этому уведомлению');
        }

        return notification;
    }

    // ==================== СТАТИЧЕСКИЕ РОУТЫ (перед динамическими) ====================

    /**
     * Получить все непрочитанные уведомления
     * GET /notifications/unread
     */
    @Get('unread')
    async getUnreadNotifications(@CurrentUser() user: any) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);

        return this.notificationsService.getUnreadNotifications(
            user.sessionId,
            user.schoolId,
            categories,
        );
    }

    /**
     * Получить количество непрочитанных уведомлений
     * GET /notifications/unread/count
     */
    @Get('unread/count')
    async getUnreadCount(@CurrentUser() user: any) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);

        return {
            count: await this.notificationsService.getUnreadCount(
                user.sessionId,
                user.schoolId,
                categories,
            ),
        };
    }

    /**
     * Отметить все уведомления как прочитанные
     * POST /notifications/read-all
     */
    @Post('read-all')
    async markAllAsRead(@CurrentUser() user: any) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);

        return this.notificationsService.markAllAsRead(
            user.sessionId,
            user.schoolId,
            categories,
        );
    }

    /**
     * Удалить все прочитанные уведомления
     * DELETE /notifications/delete-read
     * ИСПРАВЛЕНО: Переименовано с /notifications/read на /notifications/delete-read
     * чтобы избежать конфликта с DELETE /notifications/:id
     */
    @Delete('delete-read')
    async deleteReadNotifications(@CurrentUser() user: any) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);

        return this.notificationsService.deleteReadNotificationsForUser(
            user.schoolId,
            categories,
        );
    }

    // ==================== РОУТ БЕЗ ПАРАМЕТРА ====================

    /**
     * Получить все уведомления (включая прочитанные)
     * GET /notifications?limit=100
     */
    @Get()
    async getAllNotifications(
        @CurrentUser() user: any,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);

        return this.notificationsService.getAllNotifications(
            user.sessionId,
            user.schoolId,
            categories,
            limit || 100,
        );
    }

    // ==================== ДИНАМИЧЕСКИЕ РОУТЫ С :id ====================

    /**
     * Отметить уведомление как прочитанное
     * POST /notifications/:id/read
     * ИСПРАВЛЕНО: Добавлена проверка принадлежности
     */
    @Post(':id/read')
    async markAsRead(
        @Param('id', ParseIntPipe) notificationId: number,
        @CurrentUser() user: any,
    ) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);
        
        // Проверяем принадлежность
        await this.checkNotificationOwnership(notificationId, user.schoolId, categories);

        return this.notificationsService.markAsRead(notificationId, user.sessionId, user.schoolId, categories);
    }

    /**
     * Удалить уведомление
     * DELETE /notifications/:id
     * ИСПРАВЛЕНО: Добавлена проверка принадлежности
     */
    @Delete(':id')
    async deleteNotification(
        @Param('id', ParseIntPipe) notificationId: number,
        @CurrentUser() user: any,
    ) {
        const categories = await this.getUserCategories(user.schoolId, user.fullName);
        
        // Проверяем принадлежность
        await this.checkNotificationOwnership(notificationId, user.schoolId, categories);

        return this.notificationsService.deleteNotification(notificationId, user.schoolId, categories);
    }
}
