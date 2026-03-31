import api from './api';
import { Task, CreateTaskDto, UpdateTaskDto, TaskView } from '../types';

export interface TaskAttachment {
    id: number;
    taskId: number;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    uploaderName: string;
    uploadedAt: string;
}

// НОВОЕ: Расширенный интерфейс статуса выполнения
export interface CompletionStatusDetailed {
    completed: boolean;
    completionCount: number;
    completedBy?: Array<{
        fullName: string;
        completedAt: string;
    }>;
}

export const tasksService = {
    async getAll(filters?: {
        category?: string;
        priority?: string;
        creatorName?: string;
        showShared?: boolean;
        showPersonal?: boolean;
    }): Promise<Task[]> {
        const params = new URLSearchParams();
        if (filters?.category) params.append('category', filters.category);
        if (filters?.priority) params.append('priority', filters.priority);
        if (filters?.creatorName) params.append('creatorName', filters.creatorName);
        // FIX #2, #3: Фильтры по типу задач
        if (filters?.showShared === false) params.append('showShared', 'false');
        if (filters?.showPersonal === false) params.append('showPersonal', 'false');

        const response = await api.get<Task[]>(`/tasks?${params.toString()}`);
        return response.data;
    },

    async getById(id: number): Promise<Task> {
        const response = await api.get<Task>(`/tasks/${id}`);
        return response.data;
    },

    async create(data: CreateTaskDto): Promise<Task> {
        const response = await api.post<Task>('/tasks', data);
        return response.data;
    },

    async update(id: number, data: UpdateTaskDto): Promise<Task> {
        const response = await api.patch<Task>(`/tasks/${id}`, data);
        return response.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/tasks/${id}`);
    },

    async deleteOverdue(): Promise<{ message: string; count: number }> {
        const response = await api.delete('/tasks/overdue/all');
        return response.data;
    },

    async markAsViewed(id: number): Promise<void> {
        await api.post(`/tasks/${id}/view`);
    },

    async getViews(id: number): Promise<{ taskId: number; viewsCount: number; views: TaskView[] }> {
        const response = await api.get(`/tasks/${id}/views`);
        return response.data;
    },

    async toggleCompletion(taskId: number): Promise<{ completed: boolean }> {
        const response = await api.post(`/tasks/${taskId}/toggle-completion`);
        return response.data;
    },

    /**
     * Получить статус выполнения задачи
     * ОБНОВЛЕНО: Теперь возвращает имена выполнивших для создателя/админа
     */
    async getCompletionStatus(taskId: number): Promise<CompletionStatusDetailed> {
        const response = await api.get<CompletionStatusDetailed>(`/tasks/${taskId}/completion-status`);
        return response.data;
    },

    // ==================== ВЛОЖЕНИЯ ДЛЯ ЗАДАЧ ====================

    /**
     * Загрузить вложение к задаче
     */
    async uploadAttachment(taskId: number, file: File): Promise<TaskAttachment> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<TaskAttachment>(
            `/tasks/${taskId}/attachments`,
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
     * Получить список вложений задачи
     */
    async getAttachments(taskId: number): Promise<TaskAttachment[]> {
        const response = await api.get<TaskAttachment[]>(`/tasks/${taskId}/attachments`);
        return response.data;
    },

    /**
     * Скачать вложение
     * ИСПРАВЛЕНО: Правильное сохранение оригинального имени файла с поддержкой Unicode
     */
    async downloadAttachment(taskId: number, attachmentId: number, originalName: string): Promise<void> {
        const response = await api.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
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

    /**
     * Удалить вложение
     */
    async deleteAttachment(taskId: number, attachmentId: number): Promise<void> {
        await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
    },
};
