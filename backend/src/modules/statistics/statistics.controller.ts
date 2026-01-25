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

@Controller('statistics')
@UseGuards(SchoolAuthGuard)
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
}
