import {
    Controller,
    Get,
    Query,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Статистика — раздел администратора: показывает данные по всей школе
// (в интерфейсе пункт меню тоже виден только админам)
@Controller('statistics')
@UseGuards(SchoolAuthGuard, AdminGuard)
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) {}

    /**
     * Получить общую статистику
     * GET /statistics
     * Query params: startDate, endDate (optional) - строки в формате ISO
     */
    @Get()
    async getStatistics(
        @CurrentUser() user: any,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.statisticsService.getStatistics(user.schoolId, startDate, endDate);
    }

    /**
     * Получить тренды
     * GET /statistics/trends?days=30
     */
    @Get('trends')
    async getTrends(
        @CurrentUser() user: any,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.statisticsService.getTrends(user.schoolId, days || 30);
    }

    /**
     * Получить статистику по категориям
     * GET /statistics/categories
     */
    @Get('categories')
    async getCategoryStatistics(@CurrentUser() user: any) {
        return this.statisticsService.getCategoryStatistics(user.schoolId);
    }

    /**
     * Получить статистику по создателям
     * GET /statistics/creators
     */
    @Get('creators')
    async getCreatorStatistics(@CurrentUser() user: any) {
        return this.statisticsService.getCreatorStatistics(user.schoolId);
    }

    // ==================== НОВОЕ: Расширенная статистика для админов ====================

    /**
     * Получить статистику выполнения по пользователям (только для админов)
     * GET /statistics/users
     */
    @Get('users')
    @UseGuards(AdminGuard)
    async getUserStatistics(@CurrentUser() user: any) {
        return this.statisticsService.getUserCompletionStatistics(user.schoolId);
    }

    /**
     * Получить детальную статистику по каждой задаче (только для админов)
     * GET /statistics/tasks-completion
     */
    @Get('tasks-completion')
    @UseGuards(AdminGuard)
    async getTasksCompletionStatistics(@CurrentUser() user: any) {
        return this.statisticsService.getTasksCompletionStatistics(user.schoolId);
    }

    /**
     * Статистика по неделям (только для админов)
     * GET /statistics/weekly?weeks=8
     */
    @Get('weekly')
    @UseGuards(AdminGuard)
    async getWeeklyStatistics(
        @CurrentUser() user: any,
        @Query('weeks', new ParseIntPipe({ optional: true })) weeks?: number,
    ) {
        const safeWeeks = Math.min(Math.max(weeks || 8, 2), 26);
        return this.statisticsService.getWeeklyStatistics(user.schoolId, safeWeeks);
    }
}
