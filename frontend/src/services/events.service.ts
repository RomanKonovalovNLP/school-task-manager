import api from './api';

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

export interface Event {
    id: number;
    schoolId: number;
    title: string;
    description?: string;
    
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
    attachments?: EventAttachment[];
    tasks?: EventTask[];
    attachmentsCount?: number;
    tasksCount?: number;
    completedTasksCount?: number;
}

export interface CreateEventDto {
    title: string;
    description?: string;
    
    // Даты начала и окончания
    startDate: string;
    endDate?: string;
    allDay?: boolean;
    
    assigneeCategories: string[];
}

export interface UpdateEventDto {
    title?: string;
    description?: string;
    
    // Даты
    startDate?: string;
    endDate?: string | null;
    allDay?: boolean;
    
    assigneeCategories?: string[];
}

export interface CreateEventTaskDto {
    title: string;
    description?: string;
    deadline?: string;
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
        const response = await api.get<Event[]>(`/events/date/${date}`);
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
     * ИСПРАВЛЕНО: Правильное сохранение оригинального имени файла с поддержкой Unicode
     */
    async downloadAttachment(eventId: number, attachmentId: number, originalName: string): Promise<void> {
        const response = await api.get(`/events/${eventId}/attachments/${attachmentId}/download`, {
            responseType: 'blob',
        });
        
        // Пытаемся получить имя файла из Content-Disposition header
        const contentDisposition = response.headers['content-disposition'];
        let fileName = originalName;
        
        if (contentDisposition) {
            // Пробуем извлечь filename* (RFC 5987) - приоритетный для Unicode
            const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
            if (filenameStarMatch) {
                try {
                    fileName = decodeURIComponent(filenameStarMatch[1]);
                } catch (e) {
                    console.warn('Failed to decode filename*:', e);
                }
            } else {
                // Пробуем извлечь обычный filename
                const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/i);
                if (filenameMatch) {
                    try {
                        fileName = decodeURIComponent(filenameMatch[1]);
                    } catch (e) {
                        // Если декодирование не удалось, используем как есть
                        fileName = filenameMatch[1];
                    }
                }
            }
        }
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
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
};
