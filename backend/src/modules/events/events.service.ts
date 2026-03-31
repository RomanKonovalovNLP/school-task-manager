import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventAssignee } from './entities/event-assignee.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { EventTask } from './entities/event-task.entity';
import { EventTaskCompletion } from './entities/event-task-completion.entity';
import { AgendaItem } from './entities/agenda-item.entity';
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
        @InjectRepository(AgendaItem)
        private readonly agendaItemRepository: Repository<AgendaItem>,
        @InjectRepository(UserProfile)
        private readonly userProfileRepository: Repository<UserProfile>,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {
        if (!fs.existsSync(this.uploadsPath)) {
            fs.mkdirSync(this.uploadsPath, { recursive: true });
        }
    }

    /**
     * FIX #1: Декодирование имени файла из latin1 в UTF-8 (как в tasks)
     */
    private fixOriginalName(originalname: string): string {
        try {
            const decoded = Buffer.from(originalname, 'latin1').toString('utf8');
            if (decoded && !decoded.includes('\ufffd') && decoded !== originalname) {
                const reEncoded = Buffer.from(decoded, 'utf8').toString('latin1');
                if (reEncoded === originalname) {
                    return decoded;
                }
            }
        } catch {
            // Оставляем как есть
        }
        return originalname;
    }

    // ==================== Форматирование ====================

    private formatEventDate(event: Event): string {
        const startDate = new Date(event.startDate || event.eventDate);
        const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

        if (event.allDay) {
            if (event.endDate) {
                const endDate = new Date(event.endDate);
                return `${startDate.toLocaleDateString('ru-RU', options)} - ${endDate.toLocaleDateString('ru-RU', options)} (весь день)`;
            }
            return `${startDate.toLocaleDateString('ru-RU', options)} (весь день)`;
        }

        const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

        if (event.endDate) {
            const endDate = new Date(event.endDate);
            if (startDate.toDateString() === endDate.toDateString()) {
                return `${startDate.toLocaleDateString('ru-RU', options)} с ${startDate.toLocaleTimeString('ru-RU', timeOptions)} до ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
            }
            return `${startDate.toLocaleDateString('ru-RU', options)} ${startDate.toLocaleTimeString('ru-RU', timeOptions)} - ${endDate.toLocaleDateString('ru-RU', options)} ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
        }

        return `${startDate.toLocaleDateString('ru-RU', options)} в ${startDate.toLocaleTimeString('ru-RU', timeOptions)}`;
    }

    // ==================== МЕРОПРИЯТИЯ CRUD ====================

    async create(dto: CreateEventDto, user: any): Promise<Event> {
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
            eventDate: startDate,
            creatorId: user.sessionId,
            creatorName: user.fullName,
        });

        const savedEvent = await this.eventRepository.save(event);

        if (dto.assigneeCategories && dto.assigneeCategories.length > 0) {
            const assignees = dto.assigneeCategories.map(category =>
                this.assigneeRepository.create({ eventId: savedEvent.id, assigneeCategory: category })
            );
            await this.assigneeRepository.save(assignees);

            const message = `Новое мероприятие: "${dto.title}" - ${this.formatEventDate(savedEvent)}`;
            const notifications = await this.notificationsService.createEventNotification(
                user.schoolId, dto.assigneeCategories, savedEvent.id, NotificationType.NEW_EVENT, message,
            );

            if (notifications.length > 0) {
                this.notificationsGateway.sendUniqueNotificationToCategories(
                    user.schoolId, dto.assigneeCategories,
                    { ...notifications[0], createdAt: new Date().toISOString() },
                );
            }
        }

        return this.findOne(savedEvent.id, user);
    }

    async findAll(user: any): Promise<any[]> {
        const events = await this.eventRepository.find({
            where: { schoolId: user.schoolId },
            relations: ['assignees', 'attachments', 'tasks'],
            order: { startDate: 'ASC' },
        });
        return events.map(event => this.mapEventToResponse(event, user));
    }

    async findByMonth(user: any, year: number, month: number): Promise<any[]> {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const events = await this.eventRepository.find({
            where: { schoolId: user.schoolId, startDate: Between(startOfMonth, endOfMonth) },
            relations: ['assignees', 'tasks'],
            order: { startDate: 'ASC' },
        });
        return events.map(event => this.mapEventToResponse(event, user));
    }

    async findByDate(user: any, date: string): Promise<any[]> {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        const events = await this.eventRepository.find({
            where: { schoolId: user.schoolId, startDate: Between(startOfDay, endOfDay) },
            relations: ['assignees', 'tasks'],
            order: { startDate: 'ASC' },
        });
        return events.map(event => this.mapEventToResponse(event, user));
    }

    async findOne(id: number, user: any): Promise<any> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'attachments', 'tasks', 'agendaItems', 'agendaItems.attachments', 'agendaItems.tasks'],
        });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        return this.mapEventToResponse(event, user);
    }

    async update(id: number, dto: UpdateEventDto, user: any): Promise<any> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees'],
        });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName) throw new ForbiddenException('Нет прав на редактирование');

        const oldStartDate = event.startDate;
        const oldEndDate = event.endDate;

        if (dto.title !== undefined) event.title = dto.title;
        if (dto.description !== undefined) event.description = dto.description;
        if (dto.startDate !== undefined) { event.startDate = new Date(dto.startDate); event.eventDate = event.startDate; }
        if (dto.endDate !== undefined) { event.endDate = dto.endDate ? new Date(dto.endDate) : null; }
        if (dto.allDay !== undefined) event.allDay = dto.allDay;

        await this.eventRepository.save(event);

        if (dto.assigneeCategories !== undefined) {
            await this.assigneeRepository.delete({ eventId: event.id });
            if (dto.assigneeCategories.length > 0) {
                const assignees = dto.assigneeCategories.map(category =>
                    this.assigneeRepository.create({ eventId: event.id, assigneeCategory: category })
                );
                await this.assigneeRepository.save(assignees);
            }
        }

        const dateChanged =
            (dto.startDate && new Date(dto.startDate).getTime() !== oldStartDate?.getTime()) ||
            (dto.endDate !== undefined && (dto.endDate ? new Date(dto.endDate).getTime() : null) !== oldEndDate?.getTime());

        if (dateChanged) {
            const categories = dto.assigneeCategories || event.assignees.map(a => a.assigneeCategory);
            const message = `Изменена дата мероприятия: "${event.title}" - ${this.formatEventDate(event)}`;
            const notifications = await this.notificationsService.createEventNotification(
                user.schoolId, categories, event.id, NotificationType.EVENT_DATE_CHANGED, message,
            );
            if (notifications.length > 0) {
                this.notificationsGateway.sendUniqueNotificationToCategories(
                    user.schoolId, categories, { ...notifications[0], createdAt: new Date().toISOString() },
                );
            }
        }

        return this.findOne(id, user);
    }

    async remove(id: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'attachments'],
        });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName) throw new ForbiddenException('Нет прав на удаление');

        for (const attachment of event.attachments || []) {
            const filePath = path.join(this.uploadsPath, attachment.fileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        const categories = event.assignees.map(a => a.assigneeCategory);
        if (categories.length > 0) {
            await this.notificationsService.createEventNotification(
                user.schoolId, categories, event.id, NotificationType.EVENT_DELETED, `Мероприятие удалено: "${event.title}"`,
            );
        }

        await this.eventRepository.remove(event);
        return { success: true };
    }

    // ==================== ВЛОЖЕНИЯ ====================

    async uploadAttachment(eventId: number, file: MulterFile, user: any): Promise<EventAttachment> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const ext = path.extname(file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(this.uploadsPath, fileName);
        fs.writeFileSync(filePath, file.buffer);

        // FIX #1: Декодируем имя файла из latin1 в UTF-8
        const originalName = this.fixOriginalName(file.originalname);

        const attachment = this.attachmentRepository.create({
            eventId,
            fileName,
            originalName,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath,
            uploaderName: user.fullName,
        });
        return this.attachmentRepository.save(attachment);
    }

    async downloadAttachment(eventId: number, attachmentId: number, user: any): Promise<{ filePath: string; originalName: string; mimeType: string }> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId, eventId } });
        if (!attachment) throw new NotFoundException('Вложение не найдено');

        const filePath = path.join(this.uploadsPath, attachment.fileName);
        if (!fs.existsSync(filePath)) throw new NotFoundException('Файл не найден на сервере');

        return { filePath, originalName: attachment.originalName, mimeType: attachment.mimeType };
    }

    async deleteAttachment(eventId: number, attachmentId: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const attachment = await this.attachmentRepository.findOne({ where: { id: attachmentId, eventId } });
        if (!attachment) throw new NotFoundException('Вложение не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName && attachment.uploaderName !== user.fullName)
            throw new ForbiddenException('Нет прав на удаление');

        const filePath = path.join(this.uploadsPath, attachment.fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await this.attachmentRepository.delete(attachmentId);
        return { success: true };
    }

    // ==================== ЗАДАЧИ МЕРОПРИЯТИЯ ====================

    async createTask(eventId: number, dto: CreateEventTaskDto, user: any): Promise<EventTask> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const task = this.taskRepository.create({
            eventId,
            title: dto.title,
            description: dto.description,
            deadline: dto.deadline ? new Date(dto.deadline) : null,
            creatorName: user.fullName,
        });
        return this.taskRepository.save(task);
    }

    async getTasks(eventId: number, user: any): Promise<any[]> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const tasks = await this.taskRepository.find({ where: { eventId }, order: { createdAt: 'ASC' } });

        const profile = await this.userProfileRepository.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        return Promise.all(tasks.map(async (task) => {
            const completions = await this.taskCompletionRepository.find({ where: { eventTaskId: task.id } });
            const completedByMe = profile ? completions.some(c => c.userProfileId === profile.id) : false;
            return { ...task, completedByMe, completionCount: completions.length };
        }));
    }

    async updateTask(eventId: number, taskId: number, dto: UpdateEventTaskDto, user: any): Promise<EventTask> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const task = await this.taskRepository.findOne({ where: { id: taskId, eventId } });
        if (!task) throw new NotFoundException('Задача не найдена');
        if (!user.isAdmin && event.creatorName !== user.fullName && task.creatorName !== user.fullName)
            throw new ForbiddenException('Нет прав на редактирование');

        if (dto.title !== undefined) task.title = dto.title;
        if (dto.description !== undefined) task.description = dto.description;
        if (dto.deadline !== undefined) task.deadline = dto.deadline ? new Date(dto.deadline) : null;

        return this.taskRepository.save(task);
    }

    async removeTask(eventId: number, taskId: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const task = await this.taskRepository.findOne({ where: { id: taskId, eventId } });
        if (!task) throw new NotFoundException('Задача не найдена');
        if (!user.isAdmin && event.creatorName !== user.fullName && task.creatorName !== user.fullName)
            throw new ForbiddenException('Нет прав на удаление');

        await this.taskRepository.delete(taskId);
        return { success: true };
    }

    async toggleTaskCompletion(eventId: number, taskId: number, user: any): Promise<{ completed: boolean }> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const task = await this.taskRepository.findOne({ where: { id: taskId, eventId } });
        if (!task) throw new NotFoundException('Задача не найдена');

        let profile = await this.userProfileRepository.findOne({ where: { schoolId: user.schoolId, fullName: user.fullName } });
        if (!profile) {
            profile = this.userProfileRepository.create({ schoolId: user.schoolId, fullName: user.fullName });
            profile = await this.userProfileRepository.save(profile);
        }

        const existing = await this.taskCompletionRepository.findOne({ where: { eventTaskId: taskId, userProfileId: profile.id } });
        if (existing) {
            await this.taskCompletionRepository.delete(existing.id);
            return { completed: false };
        } else {
            const completion = this.taskCompletionRepository.create({ eventTaskId: taskId, userProfileId: profile.id });
            await this.taskCompletionRepository.save(completion);
            return { completed: true };
        }
    }

    // ==================== FIX #5: РАСПИСАНИЕ МЕРОПРИЯТИЯ (AGENDA) ====================

    async getAgendaItems(eventId: number, user: any): Promise<AgendaItem[]> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        return this.agendaItemRepository.find({
            where: { eventId },
            relations: ['attachments', 'tasks'],
            order: { sortOrder: 'ASC', startTime: 'ASC' },
        });
    }

    async createAgendaItem(
        eventId: number,
        data: { title: string; description?: string; startTime?: string; endTime?: string; responsibleNames?: string[] },
        user: any,
    ): Promise<AgendaItem> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName) throw new ForbiddenException('Нет прав');

        // Автоматический sortOrder
        const maxOrder = await this.agendaItemRepository
            .createQueryBuilder('item')
            .select('MAX(item.sortOrder)', 'max')
            .where('item.eventId = :eventId', { eventId })
            .getRawOne();

        const item = this.agendaItemRepository.create({
            eventId,
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            responsibleNames: data.responsibleNames || [],
            sortOrder: (maxOrder?.max || 0) + 1,
        } as Partial<AgendaItem>);

        return this.agendaItemRepository.save(item);
    }

    async updateAgendaItem(
        eventId: number,
        itemId: number,
        data: Partial<{ title: string; description: string; startTime: string; endTime: string; responsibleNames: string[] }>,
        user: any,
    ): Promise<AgendaItem> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName) throw new ForbiddenException('Нет прав');

        const item = await this.agendaItemRepository.findOne({ where: { id: itemId, eventId } });
        if (!item) throw new NotFoundException('Пункт расписания не найден');

        Object.assign(item, data);
        return this.agendaItemRepository.save(item);
    }

    async deleteAgendaItem(eventId: number, itemId: number, user: any): Promise<{ success: boolean }> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');
        if (!user.isAdmin && event.creatorName !== user.fullName) throw new ForbiddenException('Нет прав');

        const item = await this.agendaItemRepository.findOne({ where: { id: itemId, eventId }, relations: ['attachments'] });
        if (!item) throw new NotFoundException('Пункт расписания не найден');

        // Удаляем файлы вложений
        for (const att of item.attachments || []) {
            const filePath = path.join(this.uploadsPath, att.fileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await this.agendaItemRepository.remove(item);
        return { success: true };
    }

    async uploadAgendaAttachment(eventId: number, itemId: number, file: MulterFile, user: any): Promise<EventAttachment> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const item = await this.agendaItemRepository.findOne({ where: { id: itemId, eventId } });
        if (!item) throw new NotFoundException('Пункт расписания не найден');

        const ext = path.extname(file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(this.uploadsPath, fileName);
        fs.writeFileSync(filePath, file.buffer);

        const originalName = this.fixOriginalName(file.originalname);

        const attachment = this.attachmentRepository.create({
            eventId,
            agendaItemId: itemId,
            fileName,
            originalName,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath,
            uploaderName: user.fullName,
        });
        return this.attachmentRepository.save(attachment);
    }

    async createAgendaTask(eventId: number, itemId: number, dto: CreateEventTaskDto, user: any): Promise<EventTask> {
        const event = await this.eventRepository.findOne({ where: { id: eventId, schoolId: user.schoolId } });
        if (!event) throw new NotFoundException('Мероприятие не найдено');

        const item = await this.agendaItemRepository.findOne({ where: { id: itemId, eventId } });
        if (!item) throw new NotFoundException('Пункт расписания не найден');

        const task = this.taskRepository.create({
            eventId,
            agendaItemId: itemId,
            title: dto.title,
            description: dto.description,
            deadline: dto.deadline ? new Date(dto.deadline) : null,
            creatorName: user.fullName,
        });
        return this.taskRepository.save(task);
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    private mapEventToResponse(event: Event, user: any): any {
        return {
            id: event.id,
            schoolId: event.schoolId,
            title: event.title,
            description: event.description,
            startDate: event.startDate,
            endDate: event.endDate,
            allDay: event.allDay,
            eventDate: event.eventDate || event.startDate,
            creatorId: event.creatorId,
            creatorName: event.creatorName,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
            assigneeCategories: event.assignees?.map(a => a.assigneeCategory) || [],
            attachments: event.attachments || [],
            tasks: event.tasks || [],
            agendaItems: event.agendaItems || [],
            attachmentsCount: event.attachments?.length || 0,
            tasksCount: event.tasks?.length || 0,
            completedTasksCount: event.tasks?.filter(t => t.isCompleted).length || 0,
        };
    }
}
