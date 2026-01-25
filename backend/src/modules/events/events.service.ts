import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventAssignee } from './entities/event-assignee.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { EventTask } from './entities/event-task.entity';
import { EventTaskCompletion } from './entities/event-task-completion.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { CreateEventDto, UpdateEventDto, CreateEventTaskDto, UpdateEventTaskDto } from './dto/event.dto';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Тип для Multer файла
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

@Injectable()
export class EventsService {
    private readonly uploadsPath = './uploads/events';

    constructor(
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>,
        @InjectRepository(EventAssignee)
        private readonly assigneeRepository: Repository<EventAssignee>,
        @InjectRepository(EventAttachment)
        private readonly attachmentRepository: Repository<EventAttachment>,
        @InjectRepository(EventTask)
        private readonly taskRepository: Repository<EventTask>,
        @InjectRepository(EventTaskCompletion)
        private readonly taskCompletionRepository: Repository<EventTaskCompletion>,
        @InjectRepository(UserProfile)
        private readonly userProfileRepository: Repository<UserProfile>,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {
        // Создаём директорию для загрузок если её нет
        if (!fs.existsSync(this.uploadsPath)) {
            fs.mkdirSync(this.uploadsPath, { recursive: true });
        }
    }

    /**
     * Форматирование даты для сообщения
     */
    private formatEventDate(event: Event): string {
        const startDate = new Date(event.startDate || event.eventDate);
        const options: Intl.DateTimeFormatOptions = {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        };

        if (event.allDay) {
            if (event.endDate) {
                const endDate = new Date(event.endDate);
                return `${startDate.toLocaleDateString('ru-RU', options)} - ${endDate.toLocaleDateString('ru-RU', options)} (весь день)`;
            }
            return `${startDate.toLocaleDateString('ru-RU', options)} (весь день)`;
        }

        const timeOptions: Intl.DateTimeFormatOptions = {
            hour: '2-digit',
            minute: '2-digit',
        };

        if (event.endDate) {
            const endDate = new Date(event.endDate);
            if (startDate.toDateString() === endDate.toDateString()) {
                return `${startDate.toLocaleDateString('ru-RU', options)} с ${startDate.toLocaleTimeString('ru-RU', timeOptions)} до ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
            }
            return `${startDate.toLocaleDateString('ru-RU', options)} ${startDate.toLocaleTimeString('ru-RU', timeOptions)} - ${endDate.toLocaleDateString('ru-RU', options)} ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
        }

        return `${startDate.toLocaleDateString('ru-RU', options)} в ${startDate.toLocaleTimeString('ru-RU', timeOptions)}`;
    }

    /**
     * Создать мероприятие
     * ИСПРАВЛЕНИЕ: Корректная обработка undefined для startDate
     */
    async create(dto: CreateEventDto, user: any): Promise<Event> {
        // ИСПРАВЛЕНИЕ: Проверяем наличие startDate, иначе выбрасываем ошибку
        if (!dto.startDate) {
            throw new Error('startDate is required');
        }
        
        const startDate = new Date(dto.startDate);
        const endDate = dto.endDate ? new Date(dto.endDate) : null;
        const allDay = dto.allDay || false;

        const event = this.eventRepository.create({
            schoolId: user.schoolId,
            title: dto.title,
            description: dto.description,
            startDate,
            endDate,
            allDay,
            eventDate: startDate, // для обратной совместимости
            creatorId: user.sessionId,  // ИСПРАВЛЕНИЕ: используем sessionId
            creatorName: user.fullName,
        });

        const savedEvent = await this.eventRepository.save(event);

        // Создаём назначения по категориям
        if (dto.assigneeCategories && dto.assigneeCategories.length > 0) {
            const assignees = dto.assigneeCategories.map(category =>
                this.assigneeRepository.create({
                    eventId: savedEvent.id,
                    assigneeCategory: category,
                })
            );
            await this.assigneeRepository.save(assignees);

            // Отправляем уведомление о новом мероприятии
            const message = `Новое мероприятие: "${dto.title}" - ${this.formatEventDate(savedEvent)}`;
            
            const notifications = await this.notificationsService.createEventNotification(
                user.schoolId,
                dto.assigneeCategories,
                savedEvent.id,
                NotificationType.NEW_EVENT,
                message,
            );

            if (notifications.length > 0) {
                this.notificationsGateway.sendUniqueNotificationToCategories(
                    user.schoolId,
                    dto.assigneeCategories,
                    {
                        ...notifications[0],
                        createdAt: new Date().toISOString(),
                    },
                );
            }
        }

        return this.findOne(savedEvent.id, user);
    }

    /**
     * Получить все мероприятия школы
     */
    async findAll(user: any): Promise<any[]> {
        const events = await this.eventRepository.find({
            where: { schoolId: user.schoolId },
            relations: ['assignees', 'attachments', 'tasks'],
            order: { startDate: 'ASC' },
        });

        return events.map(event => this.mapEventToResponse(event, user));
    }

    /**
     * Получить мероприятия по месяцу (для календаря)
     */
    async findByMonth(user: any, year: number, month: number): Promise<any[]> {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const events = await this.eventRepository.find({
            where: {
                schoolId: user.schoolId,
                startDate: Between(startOfMonth, endOfMonth),
            },
            relations: ['assignees', 'tasks'],
            order: { startDate: 'ASC' },
        });

        return events.map(event => this.mapEventToResponse(event, user));
    }

    /**
     * Получить мероприятия по дате
     */
    async findByDate(user: any, date: string): Promise<any[]> {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        const events = await this.eventRepository.find({
            where: {
                schoolId: user.schoolId,
                startDate: Between(startOfDay, endOfDay),
            },
            relations: ['assignees', 'tasks'],
            order: { startDate: 'ASC' },
        });

        return events.map(event => this.mapEventToResponse(event, user));
    }

    /**
     * Получить одно мероприятие по ID
     */
    async findOne(id: number, user: any): Promise<any> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'attachments', 'tasks'],
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        return this.mapEventToResponse(event, user);
    }

    /**
     * Обновить мероприятие
     */
    async update(id: number, dto: UpdateEventDto, user: any): Promise<any> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees'],
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        // Проверяем права на редактирование
        if (!user.isAdmin && event.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав на редактирование');
        }

        // Сохраняем старые даты для сравнения
        const oldStartDate = event.startDate;
        const oldEndDate = event.endDate;

        // Обновляем поля
        if (dto.title !== undefined) event.title = dto.title;
        if (dto.description !== undefined) event.description = dto.description;
        if (dto.startDate !== undefined) {
            event.startDate = new Date(dto.startDate);
            event.eventDate = event.startDate; // для обратной совместимости
        }
        if (dto.endDate !== undefined) {
            event.endDate = dto.endDate ? new Date(dto.endDate) : null;
        }
        if (dto.allDay !== undefined) event.allDay = dto.allDay;

        await this.eventRepository.save(event);

        // Обновляем категории
        if (dto.assigneeCategories !== undefined) {
            await this.assigneeRepository.delete({ eventId: event.id });

            if (dto.assigneeCategories.length > 0) {
                const assignees = dto.assigneeCategories.map(category =>
                    this.assigneeRepository.create({
                        eventId: event.id,
                        assigneeCategory: category,
                    })
                );
                await this.assigneeRepository.save(assignees);
            }
        }

        // Отправляем уведомление если дата изменилась
        const dateChanged = 
            (dto.startDate && new Date(dto.startDate).getTime() !== oldStartDate?.getTime()) ||
            (dto.endDate !== undefined && 
                (dto.endDate ? new Date(dto.endDate).getTime() : null) !== oldEndDate?.getTime());

        if (dateChanged) {
            const categories = dto.assigneeCategories || event.assignees.map(a => a.assigneeCategory);
            const message = `Изменена дата мероприятия: "${event.title}" - ${this.formatEventDate(event)}`;

            await this.notificationsService.createEventNotification(
                user.schoolId,
                categories,
                event.id,
                NotificationType.EVENT_DATE_CHANGED,
                message,
            );
        }

        return this.findOne(id, user);
    }

    /**
     * Удалить мероприятие
     */
    async remove(id: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'attachments'],
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        // Проверяем права
        if (!user.isAdmin && event.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав на удаление');
        }

        // Удаляем файлы вложений
        for (const attachment of event.attachments || []) {
            const filePath = path.join(this.uploadsPath, attachment.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Отправляем уведомление
        const categories = event.assignees.map(a => a.assigneeCategory);
        if (categories.length > 0) {
            await this.notificationsService.createEventNotification(
                user.schoolId,
                categories,
                event.id,
                NotificationType.EVENT_DELETED,
                `Мероприятие удалено: "${event.title}"`,
            );
        }

        await this.eventRepository.remove(event);

        return { success: true };
    }

    // ==================== ВЛОЖЕНИЯ ====================

    /**
     * Загрузить вложение
     */
    async uploadAttachment(
        eventId: number,
        file: MulterFile,
        user: any,
    ): Promise<EventAttachment> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        // Генерируем уникальное имя файла
        const ext = path.extname(file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(this.uploadsPath, fileName);

        // Сохраняем файл
        fs.writeFileSync(filePath, file.buffer);

        // Создаём запись в БД
        const attachment = this.attachmentRepository.create({
            eventId,
            fileName,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath,  // ИСПРАВЛЕНИЕ: добавляем filePath
            uploaderName: user.fullName,
        });

        return this.attachmentRepository.save(attachment);
    }

    /**
     * Скачать вложение
     * ИСПРАВЛЕНИЕ: Возвращаем правильное оригинальное имя файла
     */
    async downloadAttachment(
        eventId: number,
        attachmentId: number,
        user: any,
    ): Promise<{ filePath: string; originalName: string; mimeType: string }> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const attachment = await this.attachmentRepository.findOne({
            where: { id: attachmentId, eventId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        const filePath = path.join(this.uploadsPath, attachment.fileName);

        if (!fs.existsSync(filePath)) {
            throw new NotFoundException('Файл не найден на сервере');
        }

        // ИСПРАВЛЕНИЕ: Возвращаем originalName для правильного имени при скачивании
        return {
            filePath,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
        };
    }

    /**
     * Удалить вложение
     */
    async deleteAttachment(
        eventId: number,
        attachmentId: number,
        user: any,
    ): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const attachment = await this.attachmentRepository.findOne({
            where: { id: attachmentId, eventId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        // Проверяем права
        if (!user.isAdmin && event.creatorName !== user.fullName && attachment.uploaderName !== user.fullName) {
            throw new ForbiddenException('Нет прав на удаление');
        }

        // Удаляем файл
        const filePath = path.join(this.uploadsPath, attachment.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await this.attachmentRepository.delete(attachmentId);

        return { success: true };
    }

    // ==================== ЗАДАЧИ МЕРОПРИЯТИЯ ====================

    /**
     * Создать задачу мероприятия
     */
    async createTask(eventId: number, dto: CreateEventTaskDto, user: any): Promise<EventTask> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const task = this.taskRepository.create({
            eventId,
            title: dto.title,
            description: dto.description,
            deadline: dto.deadline ? new Date(dto.deadline) : null,
            creatorName: user.fullName,
        });

        return this.taskRepository.save(task);
    }

    /**
     * Получить задачи мероприятия
     */
    async getTasks(eventId: number, user: any): Promise<any[]> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const tasks = await this.taskRepository.find({
            where: { eventId },
            order: { createdAt: 'ASC' },
        });

        // Получаем профиль пользователя для проверки выполнения
        const profile = await this.userProfileRepository.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        // Добавляем информацию о выполнении для каждой задачи
        const tasksWithCompletion = await Promise.all(
            tasks.map(async (task) => {
                const completions = await this.taskCompletionRepository.find({
                    where: { eventTaskId: task.id },
                });

                const completedByMe = profile
                    ? completions.some(c => c.userProfileId === profile.id)
                    : false;

                return {
                    ...task,
                    completedByMe,
                    completionCount: completions.length,
                };
            })
        );

        return tasksWithCompletion;
    }

    /**
     * Обновить задачу мероприятия
     */
    async updateTask(eventId: number, taskId: number, dto: UpdateEventTaskDto, user: any): Promise<EventTask> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const task = await this.taskRepository.findOne({
            where: { id: taskId, eventId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Проверяем права
        if (!user.isAdmin && event.creatorName !== user.fullName && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав на редактирование');
        }

        if (dto.title !== undefined) task.title = dto.title;
        if (dto.description !== undefined) task.description = dto.description;
        if (dto.deadline !== undefined) task.deadline = dto.deadline ? new Date(dto.deadline) : null;

        return this.taskRepository.save(task);
    }

    /**
     * Удалить задачу мероприятия
     */
    async removeTask(eventId: number, taskId: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const task = await this.taskRepository.findOne({
            where: { id: taskId, eventId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Проверяем права
        if (!user.isAdmin && event.creatorName !== user.fullName && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав на удаление');
        }

        await this.taskRepository.delete(taskId);

        return { success: true };
    }

    /**
     * Переключить выполнение задачи
     */
    async toggleTaskCompletion(eventId: number, taskId: number, user: any): Promise<{ completed: boolean }> {
        const event = await this.eventRepository.findOne({
            where: { id: eventId, schoolId: user.schoolId },
        });

        if (!event) {
            throw new NotFoundException('Мероприятие не найдено');
        }

        const task = await this.taskRepository.findOne({
            where: { id: taskId, eventId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Получаем или создаём профиль пользователя
        let profile = await this.userProfileRepository.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        if (!profile) {
            profile = this.userProfileRepository.create({
                schoolId: user.schoolId,
                fullName: user.fullName,
            });
            profile = await this.userProfileRepository.save(profile);
        }

        // Проверяем, выполнена ли уже задача этим пользователем
        const existingCompletion = await this.taskCompletionRepository.findOne({
            where: { eventTaskId: taskId, userProfileId: profile.id },
        });

        if (existingCompletion) {
            // Удаляем выполнение
            await this.taskCompletionRepository.delete(existingCompletion.id);
            return { completed: false };
        } else {
            // Создаём выполнение
            const completion = this.taskCompletionRepository.create({
                eventTaskId: taskId,
                userProfileId: profile.id,
            });
            await this.taskCompletionRepository.save(completion);
            return { completed: true };
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    /**
     * Преобразование события в ответ API
     */
    private mapEventToResponse(event: Event, user: any): any {
        return {
            id: event.id,
            schoolId: event.schoolId,
            title: event.title,
            description: event.description,
            startDate: event.startDate,
            endDate: event.endDate,
            allDay: event.allDay,
            eventDate: event.eventDate || event.startDate, // для обратной совместимости
            creatorId: event.creatorId,
            creatorName: event.creatorName,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            assigneeCategories: event.assignees?.map(a => a.assigneeCategory) || [],
            attachments: event.attachments || [],
            tasks: event.tasks || [],
            attachmentsCount: event.attachments?.length || 0,
            tasksCount: event.tasks?.length || 0,
            completedTasksCount: event.tasks?.filter(t => t.isCompleted).length || 0,
        };
    }
}
