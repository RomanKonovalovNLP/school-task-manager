import api from './api';
import { Task, CreateTaskDto, UpdateTaskDto, TaskView } from '../types';

export interface TaskGroup {
    id: number;
    name: string;
    sortOrder: number;
    taskIds: number[];
}

export interface TaskAttachment {
    id: number;
    taskId: number;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    uploaderName: string;
    uploaderIsPrivileged?: boolean;
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

// Режим «Сегодня» (фокус)
export interface FocusTask extends Task {
    isAuto: boolean;            // срочная — добавлена автоматически, убрать нельзя
    isCompletedByUser: boolean;
}

export interface TodayFocus {
    date: string;
    total: number;
    completed: number;
    allDone: boolean;
    tasks: FocusTask[];
}

export interface FocusActionResult {
    success: boolean;
    reason?: 'auto';
    alreadyAuto?: boolean;
    message?: string;
}

export const tasksService = {
    async getAll(filters?: {
        category?: string[];
        priority?: string[];
        creatorName?: string;
        showShared?: boolean;
        showPersonal?: boolean;
    }): Promise<Task[]> {
        const params = new URLSearchParams();
        if (filters?.category && filters.category.length) params.append('category', filters.category.join(','));
        if (filters?.priority && filters.priority.length) params.append('priority', filters.priority.join(','));
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

    // ==================== Режим «Сегодня» (фокус) ====================

    /** План на сегодня: срочные автоматически + добавленные вручную */
    async getTodayFocus(): Promise<TodayFocus> {
        const response = await api.get<TodayFocus>('/tasks/focus/today');
        return response.data;
    },

    /** Задачи, которые можно добавить в план (в т.ч. с дедлайном не сегодня) */
    async getTodayFocusCandidates(): Promise<Task[]> {
        const response = await api.get<Task[]>('/tasks/focus/today/candidates');
        return response.data;
    },

    async addToTodayFocus(taskId: number): Promise<FocusActionResult> {
        const response = await api.post<FocusActionResult>(`/tasks/focus/today/${taskId}`);
        return response.data;
    },

    /** Убрать из плана. Срочную убрать нельзя — вернётся success:false с пояснением */
    async removeFromTodayFocus(taskId: number): Promise<FocusActionResult> {
        const response = await api.delete<FocusActionResult>(`/tasks/focus/today/${taskId}`);
        return response.data;
    },

    // ==================== Персональные группы задач ====================

    async getGroups(): Promise<TaskGroup[]> {
        const response = await api.get<TaskGroup[]>('/tasks/groups');
        return response.data;
    },

    async createGroup(name: string): Promise<TaskGroup> {
        const response = await api.post<TaskGroup>('/tasks/groups', { name });
        return response.data;
    },

    async renameGroup(id: number, name: string): Promise<{ id: number; name: string }> {
        const response = await api.patch(`/tasks/groups/${id}`, { name });
        return response.data;
    },

    async deleteGroup(id: number): Promise<void> {
        await api.delete(`/tasks/groups/${id}`);
    },

    async addTaskToGroup(groupId: number, taskId: number): Promise<void> {
        await api.post(`/tasks/groups/${groupId}/items`, { taskId });
    },

    async removeTaskFromGroup(taskId: number): Promise<void> {
        await api.delete(`/tasks/groups/items/${taskId}`);
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
