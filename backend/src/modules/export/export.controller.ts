import { Controller, Get, UseGuards, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { StatisticsService } from '../statistics/statistics.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Выгрузки содержат ВСЕ задачи школы (включая чужие личные и categoryOnly),
// поэтому доступны только администраторам
@Controller('export')
@UseGuards(SchoolAuthGuard, AdminGuard)
export class ExportController {
    constructor(
        private readonly exportService: ExportService,
        private readonly statisticsService: StatisticsService,
    ) {}

    /**
     * Экспорт задач в Excel
     * GET /export/tasks/excel
     */
    @Get('tasks/excel')
    async exportTasksToExcel(@CurrentUser() user: any, @Res() res: Response) {
        const buffer = await this.exportService.exportToExcel(user.schoolId);

        const filename = `tasks_${user.schoolId}_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        res.send(buffer);
    }

    /**
     * Экспорт задач в CSV
     * GET /export/tasks/csv
     */
    @Get('tasks/csv')
    async exportTasksToCSV(@CurrentUser() user: any, @Res() res: Response) {
        const csv = await this.exportService.exportToCSV(user.schoolId);

        const filename = `tasks_${user.schoolId}_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Добавляем BOM для правильной кодировки в Excel
        res.send('\ufeff' + csv);
    }

    /**
     * Экспорт задач в JSON
     * GET /export/tasks/json
     */
    @Get('tasks/json')
    async exportTasksToJSON(@CurrentUser() user: any, @Res() res: Response) {
        const data = await this.exportService.exportToJSON(user.schoolId);

        const filename = `tasks_${user.schoolId}_${new Date().toISOString().split('T')[0]}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        res.json(data);
    }

    /**
     * Экспорт статистики в Excel
     * GET /export/statistics/excel
     */
    @Get('statistics/excel')
    async exportStatisticsToExcel(
        @CurrentUser() user: any,
        @Res() res: Response,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        // Передаём даты как строки напрямую в сервис
        const statistics = await this.statisticsService.getStatistics(
            user.schoolId,
            startDate,
            endDate,
        );

        const buffer = await this.exportService.exportStatisticsToExcel(
            user.schoolId,
            statistics,
        );

        const filename = `statistics_${user.schoolId}_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        res.send(buffer);
    }
}
