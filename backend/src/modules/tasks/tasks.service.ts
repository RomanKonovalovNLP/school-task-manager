import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskView } from './entities/task-view.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Директория для загрузок
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'tasks');

// Вспомогательная функция для получения пути к файлу
function getFilePath(fileName: string): string {
    return path.join(UPLOADS_DIR, fileName);
}

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
        @InjectRepository(TaskAssignee)
        private assigneesRepo: Repository<TaskAssignee>,
        @InjectRepository(TaskView)
        private viewsRepo: Repository<TaskView>,
        @InjectRepository(TaskCompletion)
        private completionsRepo: Repository<TaskCompletion>,
        @InjectRepository(TaskAttachment)
        private attachmentsRepo: Repository<TaskAttachment>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
        private notificationsService: NotificationsService,
        private notificationsGateway: NotificationsGateway,
    ) {
        // Создаём директорию для загрузок если её нет
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
    }

    /**
     * Создание задачи
     */
    async create(createTaskDto: CreateTaskDto, user: any): Promise<Task> {
        const task = this.tasksRepo.create({
            schoolId: user.schoolId,
            title: createTaskDto.title,
            description: createTaskDto.description,
            deadline: new Date(createTaskDto.deadline),
            creatorName: user.fullName,
            creatorId: user.sessionId,
            isPersonal: createTaskDto.isPersonal || false,
            categoryOnly: createTaskDto.categoryOnly || false,
        });

        const savedTask = await this.tasksRepo.save(task);

        // FIX #2: Для личных задач не создаём assignees и уведомления
        if (!createTaskDto.isPersonal && createTaskDto.assigneeCategories.length > 0) {
            // Сохраняем assignees
            const assignees = createTaskDto.assigneeCategories.map((category) =>
                this.assigneesRepo.create({
                    taskId: savedTask.id,
                    assigneeCategory: category,
                }),
            );
            await this.assigneesRepo.save(assignees);

            // Создаём уведомления
            await this.notificationsService.createNotification(
                user.schoolId,
                createTaskDto.assigneeCategories,
                savedTask.id,
                NotificationType.NEW_TASK,
                `Новая задача: ${savedTask.title}`,
            );

            // Отправляем через WebSocket
            this.notificationsGateway.broadcastTaskCreated(user.schoolId, savedTask);
        }

        return this.findOne(savedTask.id, user);
    }

    /**
     * Получение всех задач
     */
    async findAll(user: any, filters: TaskFilterDto): Promise<Task[]> {
        const qb = this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.assignees', 'assignee')
            .leftJoinAndSelect('task.views', 'view')
            .where('task.schoolId = :schoolId', { schoolId: user.schoolId });

        // Фильтр по категории
        if (filters.category) {
            qb.andWhere('assignee.assigneeCategory = :category', {
                category: filters.category,
            });
        }

        // Фильтр по создателю
        if (filters.creatorName) {
            qb.andWhere('task.creatorName = :creatorName', {
                creatorName: filters.creatorName,
            });
        }

        qb.orderBy('task.deadline', 'ASC');

        const tasks = await qb.getMany();

        // FIX #2: Фильтрация по видимости
        const showShared = filters.showShared !== 'false';
        const showPersonal = filters.showPersonal !== 'false';
        const userCategories = user.categories || [];

        let filtered = tasks.filter((task) => {
            // Личные задачи видны только создателю
            if ((task as any).isPersonal) {
                return (task as any).creatorId === user.sessionId;
            }
            // categoryOnly: видна только назначенным категориям + создателю + админам
            if ((task as any).categoryOnly && !user.isAdmin && (task as any).creatorId !== user.sessionId) {
                const taskCategories = task.assignees?.map(a => a.assigneeCategory) || [];
                return taskCategories.some(c => userCategories.includes(c));
            }
            return true;
        });

        // FIX #3: Фильтры Общие/Личные
        if (!showShared && !showPersonal) {
            filtered = [];
        } else if (!showShared) {
            filtered = filtered.filter(t => (t as any).isPersonal);
        } else if (!showPersonal) {
            filtered = filtered.filter(t => !(t as any).isPersonal);
        }

        // Вычисляем приоритет и добавляем дополнительные данные
        return filtered.map((task) => this.enrichTask(task, user));
    }

    /**
     * Получение одной задачи
     */
    async findOne(id: number, user: any): Promise<Task> {
        const task = await this.tasksRepo.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'views', 'attachments'],
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        return this.enrichTask(task, user);
    }

    /**
     * Обновление задачи
     */
    async update(id: number, updateTaskDto: UpdateTaskDto, user: any): Promise<Task> {
        const task = await this.findOne(id, user);

        // Проверяем права
        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав для редактирования этой задачи');
        }

        const deadlineChanged =
            updateTaskDto.deadline &&
            new Date(updateTaskDto.deadline).getTime() !== new Date(task.deadline).getTime();

        // Обновляем задачу
        Object.assign(task, {
            title: updateTaskDto.title ?? task.title,
            description: updateTaskDto.description ?? task.description,
            deadline: updateTaskDto.deadline ? new Date(updateTaskDto.deadline) : task.deadline,
            isPersonal: updateTaskDto.isPersonal ?? (task as any).isPersonal,
            categoryOnly: updateTaskDto.categoryOnly ?? (task as any).categoryOnly,
        });

        await this.tasksRepo.save(task);

        // Обновляем assignees если переданы
        if (updateTaskDto.assigneeCategories) {
            await this.assigneesRepo.delete({ taskId: id });
            const assignees = updateTaskDto.assigneeCategories.map((category) =>
                this.assigneesRepo.create({
                    taskId: id,
                    assigneeCategory: category,
                }),
            );
            await this.assigneesRepo.save(assignees);
        }

        // Отправляем уведомления
        const categories = updateTaskDto.assigneeCategories || 
            task.assignees?.map((a) => a.assigneeCategory) || [];

        if (deadlineChanged) {
            await this.notificationsService.createNotification(
                user.schoolId,
                categories,
                id,
                NotificationType.DEADLINE_CHANGED,
                `Изменён дедлайн задачи: ${task.title}`,
            );
        }

        this.notificationsGateway.broadcastTaskUpdate(user.schoolId, task);

        return this.findOne(id, user);
    }

    /**
     * Удаление задачи
     */
    async remove(id: number, user: any): Promise<{ message: string }> {
        const task = await this.findOne(id, user);

        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав для удаления этой задачи');
        }

        const categories = task.assignees?.map((a) => a.assigneeCategory) || [];

        // Удаляем вложения с диска
        const attachments = await this.attachmentsRepo.find({ where: { taskId: id } });
        for (const attachment of attachments) {
            const filePath = getFilePath(attachment.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await this.tasksRepo.remove(task);

        // Уведомляем
        this.notificationsGateway.broadcastTaskDelete(user.schoolId, id);

        return { message: 'Задача удалена' };
    }

    /**
     * Удаление просроченных задач
     */
    async removeOverdue(user: any): Promise<{ message: string; count: number }> {
        // M9: isOverdue никогда не обновляется в БД. Используем сравнение дат.
        const overdueTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.attachments', 'attachments')
            .where('task.schoolId = :schoolId', { schoolId: user.schoolId })
            .andWhere('task.deadline < NOW()')
            .getMany();

        // Удаляем вложения с диска
        for (const task of overdueTasks) {
            for (const attachment of task.attachments || []) {
                const filePath = getFilePath(attachment.fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        await this.tasksRepo.remove(overdueTasks);

        return {
            message: 'Просроченные задачи удалены',
            count: overdueTasks.length,
        };
    }

    /**
     * Отметить задачу как просмотренную
     */
    async markAsViewed(id: number, user: any): Promise<{ success: boolean }> {
        const task = await this.findOne(id, user);

        const existingView = await this.viewsRepo.findOne({
            where: { taskId: id, viewerName: user.fullName },
        });

        if (!existingView) {
            const view = this.viewsRepo.create({
                taskId: id,
                viewerName: user.fullName,
            });
            await this.viewsRepo.save(view);
        }

        return { success: true };
    }

    /**
     * Получить просмотры задачи
     */
    async getViews(id: number, user: any): Promise<{ taskId: number; viewsCount: number; views: TaskView[] }> {
        const task = await this.findOne(id, user);

        const views = await this.viewsRepo.find({
            where: { taskId: id },
            order: { viewedAt: 'DESC' },
        });

        return {
            taskId: id,
            viewsCount: views.length,
            views,
        };
    }

    /**
     * Переключить выполнение задачи
     */
    async toggleCompletion(id: number, user: any): Promise<{ completed: boolean }> {
        await this.findOne(id, user);

        // Получаем или создаём профиль пользователя
        let profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        if (!profile) {
            profile = this.userProfileRepo.create({
                schoolId: user.schoolId,
                fullName: user.fullName,
            });
            profile = await this.userProfileRepo.save(profile);
        }

        const existing = await this.completionsRepo.findOne({
            where: { taskId: id, userProfileId: profile.id },
        });

        if (existing) {
            await this.completionsRepo.remove(existing);
            return { completed: false };
        } else {
            const completion = this.completionsRepo.create({
                taskId: id,
                userProfileId: profile.id,
            });
            await this.completionsRepo.save(completion);
            return { completed: true };
        }
    }

    /**
     * Проверить, выполнена ли задача пользователем
     */
    async isCompletedByUser(id: number, user: any): Promise<boolean> {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        if (!profile) return false;

        const completion = await this.completionsRepo.findOne({
            where: { taskId: id, userProfileId: profile.id },
        });

        return !!completion;
    }

    /**
     * Получить количество выполнивших задачу
     */
    async getCompletionCount(id: number): Promise<number> {
        return this.completionsRepo.count({ where: { taskId: id } });
    }

    /**
     * НОВОЕ: Получить детальный статус выполнения
     * Для создателя и админа показывает имена выполнивших
     */
    async getCompletionStatusDetailed(id: number, user: any): Promise<{
        completed: boolean;
        completionCount: number;
        completedBy?: { fullName: string; completedAt: string }[];
    }> {
        const task = await this.findOne(id, user);
        const completed = await this.isCompletedByUser(id, user);
        const count = await this.getCompletionCount(id);

        const result: any = { completed, completionCount: count };

        // Если пользователь - создатель или админ, показываем имена
        if (user.isAdmin || task.creatorName === user.fullName) {
            const completions = await this.completionsRepo.find({
                where: { taskId: id },
                relations: ['userProfile'],
                order: { completedAt: 'DESC' },
            });

            result.completedBy = completions.map((c) => ({
                fullName: c.userProfile.fullName,
                completedAt: c.completedAt.toISOString(),
            }));
        }

        return result;
    }

    // ==================== ВЛОЖЕНИЯ ====================

    /**
     * Загрузить вложение
     */
    async uploadAttachment(id: number, file: any, user: any): Promise<TaskAttachment> {
        const task = await this.findOne(id, user);

        if (!file) {
            throw new BadRequestException('Файл не был загружен');
        }

        // Генерируем уникальное имя файла
        const ext = path.extname(file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        // Сохраняем файл
        fs.writeFileSync(filePath, file.buffer);

        // ИСПРАВЛЕНИЕ: Сохраняем оригинальное имя в UTF-8
        // Декодируем имя файла если оно пришло в неправильной кодировке
        let originalName = file.originalname;
        try {
            // Проверяем, не закодировано ли имя в latin1
            const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
            // Если декодирование дало валидный UTF-8 без replacement characters
            if (decoded && !decoded.includes('\ufffd') && decoded !== originalName) {
                // Проверяем что это действительно была проблема кодировки
                const reEncoded = Buffer.from(decoded, 'utf8').toString('latin1');
                if (reEncoded === originalName) {
                    originalName = decoded;
                }
            }
        } catch (e) {
            // Оставляем как есть
        }

        const attachment = this.attachmentsRepo.create({
            taskId: id,
            fileName,
            originalName,
            mimeType: file.mimetype,
            fileSize: file.size,
            uploaderName: user.fullName,
        });

        return this.attachmentsRepo.save(attachment);
    }

    /**
     * Получить вложения задачи
     */
    async getAttachments(id: number, user: any): Promise<TaskAttachment[]> {
        await this.findOne(id, user);

        return this.attachmentsRepo.find({
            where: { taskId: id },
            order: { uploadedAt: 'DESC' },
        });
    }

    /**
     * Скачать вложение
     */
    async downloadAttachment(
        taskId: number,
        attachmentId: number,
        user: any,
    ): Promise<TaskAttachment> {
        await this.findOne(taskId, user);

        const attachment = await this.attachmentsRepo.findOne({
            where: { id: attachmentId, taskId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        return attachment;
    }

    /**
     * Удалить вложение
     */
    async deleteAttachment(taskId: number, attachmentId: number, user: any): Promise<{ success: boolean }> {
        const task = await this.findOne(taskId, user);

        const attachment = await this.attachmentsRepo.findOne({
            where: { id: attachmentId, taskId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        // Проверяем права (создатель задачи, загрузчик файла или админ)
        if (
            !user.isAdmin &&
            task.creatorName !== user.fullName &&
            attachment.uploaderName !== user.fullName
        ) {
            throw new ForbiddenException('Нет прав для удаления этого вложения');
        }

        // Удаляем файл с диска
        const filePath = getFilePath(attachment.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await this.attachmentsRepo.remove(attachment);

        return { success: true };
    }

    // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================

    private enrichTask(task: Task, user: any): Task {
        const now = new Date();
        const deadline = new Date(task.deadline);
        const diff = deadline.getTime() - now.getTime();
        const hours = diff / (1000 * 60 * 60);

        // Определяем приоритет
        let priority: 'urgent' | 'medium' | 'low' | 'overdue';
        if (hours < 0) {
            priority = 'overdue';
            task.isOverdue = true;
        } else if (hours <= 24) {
            priority = 'urgent';
        } else if (hours <= 72) {
            priority = 'medium';
        } else {
            priority = 'low';
        }

        // Добавляем дополнительные поля
        const viewedByUser = task.views?.some((v) => v.viewerName === user.fullName) ?? false;
        const assigneeCategories = task.assignees?.map((a) => a.assigneeCategory) ?? [];

        return {
            ...task,
            priority,
            viewedByUser,
            viewsCount: task.views?.length ?? 0,
            attachmentsCount: task.attachments?.length ?? 0,
            assigneeCategories,
            isPersonal: (task as any).isPersonal || false,
            categoryOnly: (task as any).categoryOnly || false,
        } as Task;
    }
}
