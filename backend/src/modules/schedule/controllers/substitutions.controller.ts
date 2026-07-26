import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    Res,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { SchoolAuthGuard } from '../../../common/guards/school-auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { SubstitutionsService } from '../services/substitutions.service';
import { CreateSubstitutionDto } from '../dto/schedule.dto';

@Controller('schedule/substitutions')
@UseGuards(SchoolAuthGuard)
export class SubstitutionsController {
    constructor(private substitutionsService: SubstitutionsService) {}

    @Get()
    async findByDate(@Query('date') date: string, @Request() req) {
        return this.substitutionsService.findByDate(date, req.user.schoolId);
    }

    // Все замены версии расписания (для списка/отчёта)
    @Get('by-version')
    async findByVersion(@Query('versionId', ParseIntPipe) versionId: number, @Request() req) {
        return this.substitutionsService.findByVersion(versionId, req.user.schoolId);
    }

    // Доступные учителя и кабинеты для подстановки (с учётом целевой позиции)
    @UseGuards(AdminGuard)
    @Get('available')
    async getAvailable(
        @Query('lessonId', ParseIntPipe) lessonId: number,
        @Query('targetDayOfWeek') targetDayOfWeek: string,
        @Query('targetLessonNumber') targetLessonNumber: string,
        @Query('date') date: string,
        @Request() req,
    ) {
        return this.substitutionsService.getAvailableForSlot(
            lessonId,
            req.user.schoolId,
            targetDayOfWeek ? Number(targetDayOfWeek) : undefined,
            targetLessonNumber ? Number(targetLessonNumber) : undefined,
            date || undefined,
        );
    }

    // Экспорт отчёта по заменам версии в xlsx
    @UseGuards(AdminGuard)
    @Get('export')
    async export(
        @Query('versionId', ParseIntPipe) versionId: number,
        @Request() req,
        @Res() res: Response,
    ) {
        const buffer = await this.substitutionsService.exportReport(versionId, req.user.schoolId);
        const date = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="substitutions_${date}.xlsx"`);
        res.send(buffer);
    }

    @UseGuards(AdminGuard)
    @Post()
    async create(@Body() dto: CreateSubstitutionDto, @Request() req) {
        const createdBy = req.user.fullName || 'Admin';
        return this.substitutionsService.create(dto, createdBy, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.substitutionsService.remove(id, req.user.schoolId);
    }

    // Совместимость: старый эндпоинт
    @UseGuards(AdminGuard)
    @Get('available-teachers')
    async getAvailableTeachers(
        @Query('lessonId', ParseIntPipe) lessonId: number,
        @Query('date') date: string,
        @Request() req,
    ) {
        return this.substitutionsService.getAvailableTeachers(lessonId, date, req.user.schoolId);
    }
}
