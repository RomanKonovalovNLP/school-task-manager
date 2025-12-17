import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(SchoolAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /**
     * Получить все непрочитанные уведомления
     * GET /notifications/unread
     */
    @Get('unread')
    async getUnreadNotifications(@CurrentUser() user: any) {
        // TODO: Получить категории пользователя из базы
        const categories = ['Учителя', 'Администрация']; // заглушка

        return this.notificationsService.getUnreadNotifications(
            user.sessionId,
            user.schoolId,
            categories,
        );
    }

    /**
     * Получить все уведомления (включая прочитанные)
     * GET /notifications?limit=100
     */
    @Get()
    async getAllNotifications(
        @CurrentUser() user: any,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        // TODO: Получить категории пользователя из базы
        const categories = ['Учителя', 'Администрация']; // заглушка

        return this.notificationsService.getAllNotifications(
            user.sessionId,
            user.schoolId,
            categories,
            limit || 100,
        );
    }

    /**
     * Получить количество непрочитанных уведомлений
     * GET /notifications/unread/count
     */
    @Get('unread/count')
    async getUnreadCount(@CurrentUser() user: any) {
        // TODO: Получить категории пользователя из базы
        const categories = ['Учителя', 'Администрация']; // заглушка

        return {
            count: await this.notificationsService.getUnreadCount(
                user.sessionId,
                user.schoolId,
                categories,
            ),
        };
    }

    /**
     * Отметить уведомление как прочитанное
     * POST /notifications/:id/read
     */
    @Post(':id/read')
    async markAsRead(
        @Param('id', ParseIntPipe) notificationId: number,
        @CurrentUser() user: any,
    ) {
        return this.notificationsService.markAsRead(notificationId, user.sessionId);
    }

    /**
     * Отметить все уведомления как прочитанные
     * POST /notifications/read-all
     */
    @Post('read-all')
    async markAllAsRead(@CurrentUser() user: any) {
        // TODO: Получить категории пользователя из базы
        const categories = ['Учителя', 'Администрация']; // заглушка

        return this.notificationsService.markAllAsRead(
            user.sessionId,
            user.schoolId,
            categories,
        );
    }

    /**
     * Удалить уведомление
     * DELETE /notifications/:id
     */
    @Delete(':id')
    async deleteNotification(@Param('id', ParseIntPipe) notificationId: number) {
        return this.notificationsService.deleteNotification(notificationId);
    }

    /**
     * Удалить все прочитанные уведомления
     * DELETE /notifications/read
     */
    @Delete('read')
    async deleteReadNotifications(@CurrentUser() user: any) {
        // TODO: Получить категории пользователя из базы
        const categories = ['Учителя', 'Администрация']; // заглушка

        return this.notificationsService.deleteAllForCategories(
            user.schoolId,
            categories,
        );
    }
}