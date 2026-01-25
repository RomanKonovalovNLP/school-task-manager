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
    UseInterceptors,
    UploadedFile,
    ParseIntPipe,
    Res,
    StreamableFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EventsService } from './events.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEventDto, UpdateEventDto, CreateEventTaskDto, UpdateEventTaskDto } from './dto/event.dto';
import * as fs from 'fs';
import * as path from 'path';

// Максимальный размер файла: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Директория для хранения файлов
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

@Controller('events')
@UseGuards(SchoolAuthGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    /**
     * Создать мероприятие
     * POST /events
     */
    @Post()
    create(@Body() createEventDto: CreateEventDto, @CurrentUser() user: any) {
        return this.eventsService.create(createEventDto, user);
    }

    /**
     * Получить все мероприятия
     * GET /events
     */
    @Get()
    findAll(@CurrentUser() user: any) {
        return this.eventsService.findAll(user);
    }

    /**
     * Получить мероприятия по месяцу (для календаря)
     * GET /events/calendar?year=2025&month=1
     */
    @Get('calendar')
    findByMonth(
        @CurrentUser() user: any,
        @Query('year', ParseIntPipe) year: number,
        @Query('month', ParseIntPipe) month: number,
    ) {
        return this.eventsService.findByMonth(user, year, month);
    }

    /**
     * Получить мероприятия по дате
     * GET /events/date/2025-01-15
     */
    @Get('date/:date')
    findByDate(@CurrentUser() user: any, @Param('date') date: string) {
        return this.eventsService.findByDate(user, date);
    }

    /**
     * Получить одно мероприятие
     * GET /events/:id
     */
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.eventsService.findOne(id, user);
    }

    /**
     * Обновить мероприятие
     * PUT /events/:id
     */
    @Put(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateEventDto: UpdateEventDto,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.update(id, updateEventDto, user);
    }

    /**
     * Удалить мероприятие
     * DELETE /events/:id
     */
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.eventsService.remove(id, user);
    }

    // ==================== ВЛОЖЕНИЯ ====================

    /**
     * Загрузить вложение
     * POST /events/:id/attachments
     * Ограничение: 10 MB
     */
    @Post(':id/attachments')
    @UseInterceptors(FileInterceptor('file'))
    uploadAttachment(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: any,
        @CurrentUser() user: any,
    ) {
        // Проверка наличия файла
        if (!file) {
            throw new BadRequestException('Файл не был загружен');
        }

        // Проверка размера файла
        if (file.size > MAX_FILE_SIZE) {
            throw new BadRequestException(
                `Размер файла превышает максимально допустимый (10 MB). Размер вашего файла: ${(file.size / (1024 * 1024)).toFixed(2)} MB`
            );
        }

        return this.eventsService.uploadAttachment(id, file, user);
    }

    /**
     * Скачать вложение
     * GET /events/:id/attachments/:attachmentId/download
     * ИСПРАВЛЕНО: Добавлена защита от path traversal + правильная кодировка Unicode
     */
    @Get(':id/attachments/:attachmentId/download')
    async downloadAttachment(
        @Param('id', ParseIntPipe) id: number,
        @Param('attachmentId', ParseIntPipe) attachmentId: number,
        @CurrentUser() user: any,
        @Res({ passthrough: true }) res: Response,
    ) {
        const attachment = await this.eventsService.downloadAttachment(id, attachmentId, user);

        // ИСПРАВЛЕНО: Проверка path traversal - файл должен быть в разрешённой директории
        const resolvedPath = path.resolve(attachment.filePath);
        if (!resolvedPath.startsWith(UPLOADS_DIR)) {
            throw new BadRequestException('Недопустимый путь к файлу');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new BadRequestException('Файл не найден');
        }

        const file = fs.createReadStream(resolvedPath);

        // ИСПРАВЛЕНО: Правильная кодировка Unicode имён файлов
        const originalName = attachment.originalName;

        // RFC 5987 кодирование для поддержки unicode в Content-Disposition
        const encodedName = encodeURIComponent(originalName)
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A');

        // Fallback имя для старых браузеров (только ASCII)
        const asciiName = originalName.replace(/[^\x20-\x7E]/g, '_');

        res.set({
            'Content-Type': attachment.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
            'Cache-Control': 'no-cache',
        });

        return new StreamableFile(file);
    }

    /**
     * Удалить вложение
     * DELETE /events/:id/attachments/:attachmentId
     */
    @Delete(':id/attachments/:attachmentId')
    removeAttachment(
        @Param('id', ParseIntPipe) id: number,
        @Param('attachmentId', ParseIntPipe) attachmentId: number,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.deleteAttachment(id, attachmentId, user);
    }

    // ==================== ЗАДАЧИ МЕРОПРИЯТИЯ ====================

    /**
     * Создать задачу мероприятия
     * POST /events/:id/tasks
     */
    @Post(':id/tasks')
    createTask(
        @Param('id', ParseIntPipe) id: number,
        @Body() createTaskDto: CreateEventTaskDto,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.createTask(id, createTaskDto, user);
    }

    /**
     * Получить задачи мероприятия
     * GET /events/:id/tasks
     */
    @Get(':id/tasks')
    getTasks(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.eventsService.getTasks(id, user);
    }

    /**
     * Обновить задачу мероприятия
     * PUT /events/:id/tasks/:taskId
     */
    @Put(':id/tasks/:taskId')
    updateTask(
        @Param('id', ParseIntPipe) id: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @Body() updateTaskDto: UpdateEventTaskDto,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.updateTask(id, taskId, updateTaskDto, user);
    }

    /**
     * Удалить задачу мероприятия
     * DELETE /events/:id/tasks/:taskId
     */
    @Delete(':id/tasks/:taskId')
    removeTask(
        @Param('id', ParseIntPipe) id: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.removeTask(id, taskId, user);
    }

    /**
     * Переключить выполнение задачи
     * POST /events/:id/tasks/:taskId/toggle
     */
    @Post(':id/tasks/:taskId/toggle')
    toggleTaskCompletion(
        @Param('id', ParseIntPipe) id: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @CurrentUser() user: any,
    ) {
        return this.eventsService.toggleTaskCompletion(id, taskId, user);
    }
}
