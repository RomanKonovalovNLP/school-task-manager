import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { SchoolAuthGuard } from '../../../common/guards/school-auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { LessonsService } from '../services/lessons.service';
import { ScheduleValidatorService } from '../services/schedule-validator.service';
import {
    CreateLessonDto,
    UpdateLessonDto,
    MoveLessonDto,
    CheckPlacementDto,
} from '../dto/schedule.dto';

@Controller('schedule/lessons')
@UseGuards(SchoolAuthGuard)
export class LessonsController {
    constructor(
        private lessonsService: LessonsService,
        private validatorService: ScheduleValidatorService,
    ) {}

    /**
     * Добавить урок в расписание (из нагрузки)
     */
    @UseGuards(AdminGuard)
    @Post()
    async create(
        @Body() dto: CreateLessonDto,
        @Request() req,
    ) {
        // Проверяем возможность размещения
        const validation = await this.validatorService.checkPlacement({
            workloadId: dto.workloadId,
            dayOfWeek: dto.dayOfWeek,
            lessonNumber: dto.lessonNumber,
            weekType: dto.weekType,
            roomId: dto.roomId,
        }, req.user.schoolId);

        if (!validation.canPlace) {
            return {
                success: false,
                errors: validation.conflicts,
            };
        }

        const lesson = await this.lessonsService.create(dto, req.user.schoolId);

        // Получаем обновлённый список конфликтов
        const conflicts = await this.validatorService.getConflictsForLesson(lesson.id);

        return {
            success: true,
            lesson,
            conflicts,
        };
    }

    /**
     * Переместить урок (drag & drop)
     */
    @UseGuards(AdminGuard)
    @Put(':id/move')
    async move(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: MoveLessonDto,
        @Request() req,
    ) {
        // Проверяем возможность размещения в новом месте
        const lesson = await this.lessonsService.findOne(id, req.user.schoolId);
        
        const validation = await this.validatorService.checkPlacement({
            workloadId: lesson.workloadId,
            dayOfWeek: dto.dayOfWeek,
            lessonNumber: dto.lessonNumber,
            weekType: dto.weekType || lesson.weekType,
            roomId: dto.roomId || lesson.roomId,
            excludeLessonId: id, // Исключаем текущий урок из проверки
        });

        if (!validation.canPlace && validation.conflicts.some(c => c.type === 'hard')) {
            return {
                success: false,
                errors: validation.conflicts.filter(c => c.type === 'hard'),
                warnings: validation.conflicts.filter(c => c.type === 'soft'),
            };
        }

        const updatedLesson = await this.lessonsService.move(id, dto, req.user.schoolId);

        // Получаем обновлённые конфликты
        const newConflicts = await this.validatorService.getConflictsForLesson(updatedLesson.id);

        return {
            success: true,
            lesson: updatedLesson,
            conflicts: newConflicts,
            warnings: validation.conflicts.filter(c => c.type === 'soft'),
        };
    }

    /**
     * Обновить урок (кабинет, блокировка)
     */
    @UseGuards(AdminGuard)
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateLessonDto,
        @Request() req,
    ) {
        return this.lessonsService.update(id, dto, req.user.schoolId);
    }

    /**
     * Удалить урок из расписания (вернуть в нагрузку)
     */
    @UseGuards(AdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
    ) {
        await this.lessonsService.remove(id, req.user.schoolId);
    }

    /**
     * Заблокировать/разблокировать урок
     */
    @UseGuards(AdminGuard)
    @Post(':id/toggle-lock')
    async toggleLock(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
    ) {
        return this.lessonsService.toggleLock(id, req.user.schoolId);
    }

    /**
     * Проверить возможность размещения урока
     */
    @UseGuards(AdminGuard)
    @Post('check-placement')
    async checkPlacement(
        @Body() dto: CheckPlacementDto,
        @Request() req,
    ) {
        const result = await this.validatorService.checkPlacement(dto, req.user.schoolId);

        // Если нельзя разместить, предлагаем альтернативы
        if (!result.canPlace) {
            const suggestions = await this.validatorService.getSuggestions(
                dto.workloadId,
                req.user.schoolId,
            );
            return {
                ...result,
                suggestions,
            };
        }

        return result;
    }

    /**
     * Получить доступные слоты для нагрузки
     */
    @UseGuards(AdminGuard)
    @Get('available-slots/:workloadId')
    async getAvailableSlots(
        @Param('workloadId', ParseIntPipe) workloadId: number,
        @Request() req,
    ) {
        return this.validatorService.getAvailableSlots(workloadId, req.user.schoolId);
    }

    /**
     * Получить информацию о слоте (что там сейчас)
     */
    @UseGuards(AdminGuard)
    @Get('slot-info')
    async getSlotInfo(
        @Query('versionId', ParseIntPipe) versionId: number,
        @Query('dayOfWeek', ParseIntPipe) dayOfWeek: number,
        @Query('lessonNumber', ParseIntPipe) lessonNumber: number,
        @Query('weekType') weekType: string,
        @Request() req,
    ) {
        return this.lessonsService.getSlotInfo(
            versionId,
            dayOfWeek,
            lessonNumber,
            weekType as any,
            req.user.schoolId,
        );
    }
}
