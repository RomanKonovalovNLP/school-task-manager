import {
    Controller, Get, Post, Put, Body, Param, Query,
    UseGuards, ParseIntPipe, Request,
} from '@nestjs/common';
import { CalendarService } from '../services/calendar.service';
import { SchoolAuthGuard } from '../../../common/guards/school-auth.guard';
import { DayType } from '../entities/calendar-day.entity';

@Controller('schedule/versions/:versionId/calendar')
@UseGuards(SchoolAuthGuard)
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) {}

    /**
     * Получить все календарные дни версии
     * GET /schedule/versions/:versionId/calendar
     */
    @Get()
    async getCalendarDays(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Request() req,
    ) {
        return this.calendarService.getCalendarDays(versionId, req.user.schoolId);
    }

    /**
     * Получить дни конкретной недели
     * GET /schedule/versions/:versionId/calendar/week?start=2025-09-01
     */
    @Get('week')
    async getWeekDays(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Query('start') weekStart: string,
        @Request() req,
    ) {
        return this.calendarService.getWeekDays(versionId, req.user.schoolId, weekStart);
    }

    /**
     * Сгенерировать календарь для периода
     * POST /schedule/versions/:versionId/calendar/generate
     */
    @Post('generate')
    async generateCalendar(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Body() body: { startDate: string; endDate: string },
        @Request() req,
    ) {
        return this.calendarService.generateCalendar(
            versionId, req.user.schoolId, body.startDate, body.endDate,
        );
    }

    /**
     * Обновить один день
     * PUT /schedule/versions/:versionId/calendar/day
     */
    @Put('day')
    async updateDay(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Body() body: { date: string; dayType: DayType; maxLessons?: number; note?: string },
        @Request() req,
    ) {
        return this.calendarService.updateDay(
            versionId, req.user.schoolId, body.date, body.dayType, body.maxLessons, body.note,
        );
    }

    /**
     * Массовое обновление дней
     * PUT /schedule/versions/:versionId/calendar/bulk
     */
    @Put('bulk')
    async bulkUpdateDays(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Body() body: { days: Array<{ date: string; dayType: DayType; maxLessons?: number; note?: string }> },
        @Request() req,
    ) {
        return this.calendarService.bulkUpdateDays(versionId, req.user.schoolId, body.days);
    }

    /**
     * Статистика календаря
     * GET /schedule/versions/:versionId/calendar/stats
     */
    @Get('stats')
    async getStats(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Request() req,
    ) {
        return this.calendarService.getCalendarStats(versionId, req.user.schoolId);
    }
}
