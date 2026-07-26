import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    ParseIntPipe,
    UseInterceptors,
    UploadedFile,
    Res,
    StreamableFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as fs from 'fs';
import * as path from 'path';

// Директория для хранения файлов
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

@Controller('tasks')
@UseGuards(SchoolAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) {}

    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
        return this.tasksService.create(createTaskDto, user);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() filters: TaskFilterDto) {
        return this.tasksService.findAll(user, filters);
    }

    // ==================== Персональные группы задач (static routes перед :id) ====================

    @Get('groups')
    getGroups(@CurrentUser() user: any) {
        return this.tasksService.getGroups(user);
    }

    @Post('groups')
    createGroup(@Body('name') name: string, @CurrentUser() user: any) {
        return this.tasksService.createGroup(user, name);
    }

    @Patch('groups/:id')
    renameGroup(@Param('id', ParseIntPipe) id: number, @Body('name') name: string, @CurrentUser() user: any) {
        return this.tasksService.renameGroup(user, id, name);
    }

    // ВАЖНО: более специфичный маршрут объявляем раньше groups/:id
    @Delete('groups/items/:taskId')
    removeFromGroup(@Param('taskId', ParseIntPipe) taskId: number, @CurrentUser() user: any) {
        return this.tasksService.removeTaskFromGroup(user, taskId);
    }

    @Delete('groups/:id')
    deleteGroup(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.deleteGroup(user, id);
    }

    @Post('groups/:id/items')
    addToGroup(@Param('id', ParseIntPipe) id: number, @Body('taskId', ParseIntPipe) taskId: number, @CurrentUser() user: any) {
        return this.tasksService.addTaskToGroup(user, id, taskId);
    }

    // ==================== Режим «Сегодня» (фокус) ====================

    /** План на сегодня: срочные задачи автоматически + добавленные вручную */
    @Get('focus/today')
    getTodayFocus(@CurrentUser() user: any) {
        return this.tasksService.getTodayFocus(user);
    }

    /** Задачи, которые можно добавить в план на сегодня */
    @Get('focus/today/candidates')
    getTodayFocusCandidates(@CurrentUser() user: any) {
        return this.tasksService.getTodayFocusCandidates(user);
    }

    /** Добавить задачу в план на сегодня */
    @Post('focus/today/:taskId')
    addToTodayFocus(@Param('taskId', ParseIntPipe) taskId: number, @CurrentUser() user: any) {
        return this.tasksService.addToTodayFocus(user, taskId);
    }

    /** Убрать задачу из плана (срочную убрать нельзя — вернётся пояснение) */
    @Delete('focus/today/:taskId')
    removeFromTodayFocus(@Param('taskId', ParseIntPipe) taskId: number, @CurrentUser() user: any) {
        return this.tasksService.removeFromTodayFocus(user, taskId);
    }

    // ==================== ИСПРАВЛЕНИЕ: Статические роуты ПЕРЕД динамическими ====================

    /**
     * Удалить все просроченные задачи (только админ)
     * DELETE /tasks/overdue/all
     * ИСПРАВЛЕНО: Перемещено ВЫШЕ /tasks/:id
     */
    @Delete('overdue/all')
    @UseGuards(AdminGuard)
    removeOverdue(@CurrentUser() user: any) {
        return this.tasksService.removeOverdue(user);
    }

    // ==================== Динамические роуты с :id ====================

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.findOne(id, user);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTaskDto: UpdateTaskDto,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.update(id, updateTaskDto, user);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.remove(id, user);
    }

    @Post(':id/view')
    markAsViewed(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.markAsViewed(id, user);
    }

    @Get(':id/views')
    getViews(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.getViews(id, user);
    }

    @Post(':id/toggle-completion')
    async toggleCompletion(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.toggleCompletion(id, user);
    }

    /**
     * Получить статус выполнения задачи
     * ИСПРАВЛЕНО: Добавлены имена выполнивших для создателя/админа
     */
    @Get(':id/completion-status')
    async getCompletionStatus(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.getCompletionStatusDetailed(id, user);
    }

    // ==================== ВЛОЖЕНИЯ ДЛЯ ЗАДАЧ ====================

    /**
     * Загрузить вложение к задаче
     * POST /tasks/:id/attachments
     */
    @Post(':id/attachments')
    @UseInterceptors(FileInterceptor('file'))
    uploadAttachment(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: any,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.uploadAttachment(id, file, user);
    }

    /**
     * Получить список вложений задачи
     * GET /tasks/:id/attachments
     */
    @Get(':id/attachments')
    getAttachments(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.getAttachments(id, user);
    }

    /**
     * Скачать вложение
     * GET /tasks/:id/attachments/:attachmentId/download
     * ИСПРАВЛЕНО: Правильная кодировка UTF-8 для имён файлов + защита от path traversal
     */
    @Get(':id/attachments/:attachmentId/download')
    async downloadAttachment(
        @Param('id', ParseIntPipe) id: number,
        @Param('attachmentId', ParseIntPipe) attachmentId: number,
        @CurrentUser() user: any,
        @Res({ passthrough: true }) res: Response,
    ) {
        const attachment = await this.tasksService.downloadAttachment(id, attachmentId, user);

        // ИСПРАВЛЕНИЕ: Вычисляем путь к файлу из fileName (т.к. entity не хранит filePath)
        const filePath = path.join(UPLOADS_DIR, 'tasks', attachment.fileName);
        const resolvedPath = path.resolve(filePath);
        
        // Проверка path traversal - файл должен быть в разрешённой директории
        if (!resolvedPath.startsWith(UPLOADS_DIR)) {
            throw new BadRequestException('Недопустимый путь к файлу');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new BadRequestException('Файл не найден');
        }

        const file = fs.createReadStream(resolvedPath);

        // ИСПРАВЛЕНИЕ: Правильная кодировка UTF-8 для имён файлов
        // Используем оригинальное имя из БД напрямую
        const originalName = attachment.originalName;

        // RFC 5987 кодирование для поддержки unicode в Content-Disposition
        const encodedFilename = encodeURIComponent(originalName)
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A');

        // Fallback имя для старых браузеров (только ASCII)
        const asciiFilename = originalName.replace(/[^\x20-\x7E]/g, '_');

        res.set({
            'Content-Type': attachment.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
            'Cache-Control': 'no-cache',
        });

        return new StreamableFile(file);
    }

    /**
     * Удалить вложение
     * DELETE /tasks/:id/attachments/:attachmentId
     */
    @Delete(':id/attachments/:attachmentId')
    deleteAttachment(
        @Param('id', ParseIntPipe) id: number,
        @Param('attachmentId', ParseIntPipe) attachmentId: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.deleteAttachment(id, attachmentId, user);
    }
}
