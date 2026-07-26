import api from './api';
import { extractFilenameFromHeaders, downloadBlob } from '../utils/downloadUtils';

export interface EventAttachment {
    id: number;
    eventId: number;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    uploaderName: string;
    uploadedAt: string;
}

export interface EventTask {
    id: number;
    eventId: number;
    title: string;
    description?: string;
    deadline?: string;
    creatorName: string;
    isCompleted: boolean;
    completedBy?: string;
    completedAt?: string;
    completedByMe?: boolean;
    completionCount?: number;
    createdAt: string;
    updatedAt: string;
}

// FIX #5: Пункт расписания мероприятия (подмероприятие)
export interface AgendaItem {
    id: number;
    eventId: number;
    title: string;
    description?: string;
    startTime?: string; // HH:MM
    endTime?: string;   // HH:MM
    sortOrder: number;
    responsibleNames?: string[];
    attachments?: EventAttachment[];
    tasks?: EventTask[];
    createdAt: string;
    updatedAt: string;
}

export interface Event {
    id: number;
    schoolId: number;
    title: string;
    description?: string;
    location?: string;
    recurrence?: string | null;

    // Дата/время начала и окончания
    startDate: string;
    endDate?: string | null;
    allDay: boolean;

    // Для обратной совместимости
    eventDate: string;

    creatorId: number;
    creatorName: string;
    createdAt: string;
    updatedAt: string;
    assigneeCategories: string[];
    assigneeUsers?: string[];
    attachments?: EventAttachment[];
    tasks?: EventTask[];
    agendaItems?: AgendaItem[];
    attachmentsCount?: number;
    tasksCount?: number;
    completedTasksCount?: number;
}

export interface CreateEventDto {
    title: string;
    description?: string;
    location?: string;
    recurrence?: string;
    recurrenceUntil?: string;

    // Даты начала и окончания
    startDate: string;
    endDate?: string;
    allDay?: boolean;

    assigneeCategories?: string[];
    assigneeUsers?: string[];
}

export interface UpdateEventDto {
    title?: string;
    description?: string;
    location?: string;

    // Даты
    startDate?: string;
    endDate?: string | null;
    allDay?: boolean;

    assigneeCategories?: string[];
    assigneeUsers?: string[];
}

export interface CreateEventTaskDto {
    title: string;
    description?: string;
    deadline?: string;
}

export interface CreateAgendaItemDto {
    title: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    responsibleNames?: string[];
}

export const eventsService = {
    // Мероприятия
    async getAll(): Promise<Event[]> {
        const response = await api.get<Event[]>('/events');
        return response.data;
    },

    async getById(id: number): Promise<Event> {
        const response = await api.get<Event>(`/events/${id}`);
        return response.data;
    },

    async getByMonth(year: number, month: number): Promise<Event[]> {
        const response = await api.get<Event[]>(`/events/calendar?year=${year}&month=${month}`);
        return response.data;
    },

    async getByDate(date: string): Promise<Event[]> {
        // Передаём часовой пояс клиента, чтобы день считался в поясе пользователя,
        // а не сервера (иначе мероприятия «на весь день» могут выпадать из выборки)
        const tz = new Date().getTimezoneOffset();
        const response = await api.get<Event[]>(`/events/date/${date}?tz=${tz}`);
        return response.data;
    },

    async create(data: CreateEventDto): Promise<Event> {
        const response = await api.post<Event>('/events', data);
        return response.data;
    },

    async update(id: number, data: UpdateEventDto): Promise<Event> {
        const response = await api.put<Event>(`/events/${id}`, data);
        return response.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/events/${id}`);
    },

    // Вложения
    async uploadAttachment(eventId: number, file: File): Promise<EventAttachment> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<EventAttachment>(
            `/events/${eventId}/attachments`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },

    /**
     * Скачать вложение
     * FIX #1: Используем общую утилиту downloadUtils для правильной кодировки Unicode
     */
    async downloadAttachment(eventId: number, attachmentId: number, originalName: string): Promise<void> {
        const response = await api.get(`/events/${eventId}/attachments/${attachmentId}/download`, {
            responseType: 'blob',
        });

        const fileName = extractFilenameFromHeaders(
            response.headers['content-disposition'],
            originalName,
        );

        downloadBlob(response.data, fileName, response.headers['content-type']);
    },

    async deleteAttachment(eventId: number, attachmentId: number): Promise<void> {
        await api.delete(`/events/${eventId}/attachments/${attachmentId}`);
    },

    // Задачи мероприятия
    async getTasks(eventId: number): Promise<EventTask[]> {
        const response = await api.get<EventTask[]>(`/events/${eventId}/tasks`);
        return response.data;
    },

    async createTask(eventId: number, data: CreateEventTaskDto): Promise<EventTask> {
        const response = await api.post<EventTask>(`/events/${eventId}/tasks`, data);
        return response.data;
    },

    async updateTask(eventId: number, taskId: number, data: Partial<CreateEventTaskDto>): Promise<EventTask> {
        const response = await api.put<EventTask>(`/events/${eventId}/tasks/${taskId}`, data);
        return response.data;
    },

    async deleteTask(eventId: number, taskId: number): Promise<void> {
        await api.delete(`/events/${eventId}/tasks/${taskId}`);
    },

    async toggleTaskCompletion(eventId: number, taskId: number): Promise<{ completed: boolean }> {
        const response = await api.post<{ completed: boolean }>(`/events/${eventId}/tasks/${taskId}/toggle`);
        return response.data;
    },

    // ==================== FIX #5: Расписание мероприятия (Agenda) ====================

    async getAgendaItems(eventId: number): Promise<AgendaItem[]> {
        const response = await api.get<AgendaItem[]>(`/events/${eventId}/agenda`);
        return response.data;
    },

    async createAgendaItem(eventId: number, data: CreateAgendaItemDto): Promise<AgendaItem> {
        const response = await api.post<AgendaItem>(`/events/${eventId}/agenda`, data);
        return response.data;
    },

    async updateAgendaItem(eventId: number, itemId: number, data: Partial<CreateAgendaItemDto>): Promise<AgendaItem> {
        const response = await api.put<AgendaItem>(`/events/${eventId}/agenda/${itemId}`, data);
        return response.data;
    },

    async deleteAgendaItem(eventId: number, itemId: number): Promise<void> {
        await api.delete(`/events/${eventId}/agenda/${itemId}`);
    },

    // Вложения и задачи пункта расписания
    async uploadAgendaAttachment(eventId: number, itemId: number, file: File): Promise<EventAttachment> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<EventAttachment>(
            `/events/${eventId}/agenda/${itemId}/attachments`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    },

    async createAgendaTask(eventId: number, itemId: number, data: CreateEventTaskDto): Promise<EventTask> {
        const response = await api.post<EventTask>(`/events/${eventId}/agenda/${itemId}/tasks`, data);
        return response.data;
    },
};
