import api from './api';
import { TaskPosition, TaskGroup, TaskPositionsResponse } from '../types';

export const taskPositionsService = {
    /**
     * Получить все позиции и группы
     */
    async getAll(): Promise<TaskPositionsResponse> {
        const response = await api.get('/task-positions');
        return response.data;
    },

    /**
     * Обновить позицию таски
     */
    async updatePosition(taskId: number, x: number, y: number): Promise<TaskPosition> {
        const response = await api.patch(`/task-positions/${taskId}`, {
            x,
            y,
        });
        return response.data;
    },

    /**
     * Создать группу тасок
     */
    async createGroup(taskIds: number[], x: number, y: number): Promise<TaskGroup> {
        const response = await api.post('/task-positions/group', {
            taskIds,
            x,
            y,
        });
        return response.data;
    },

    /**
     * Добавить таску в группу
     */
    async addTaskToGroup(groupId: number, taskId: number): Promise<{ success: boolean }> {
        const response = await api.post(
            `/task-positions/group/${groupId}/task/${taskId}`
        );
        return response.data;
    },

    /**
     * Переместить группу
     */
    async moveGroup(groupId: number, x: number, y: number): Promise<{ success: boolean }> {
        const response = await api.patch(
            `/task-positions/group/${groupId}/move`,
            {
                x,
                y,
            }
        );
        return response.data;
    },

    /**
     * Разгруппировать все таски
     */
    async ungroupTasks(groupId: number): Promise<{ success: boolean }> {
        const response = await api.delete(
            `/task-positions/group/${groupId}`
        );
        return response.data;
    },

    /**
     * Удалить таску из группы
     */
    async removeTaskFromGroup(
        groupId: number,
        taskId: number,
        newX: number,
        newY: number
    ): Promise<{ success: boolean }> {
        const response = await api.delete(
            `/task-positions/group/${groupId}/task/${taskId}?x=${newX}&y=${newY}`
        );
        return response.data;
    },

    /**
     * Сбросить все позиции к дефолтному layout
     */
    async resetToDefaultLayout(): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/task-positions/reset');
        return response.data;
    },

    /**
     * Массовое обновление позиций
     */
    async bulkUpdatePositions(
        updates: Array<{ taskId: number; x: number; y: number }>
    ): Promise<{ success: boolean; updated: number }> {
        const response = await api.patch('/task-positions/bulk', {
            updates,
        });
        return response.data;
    },

    /**
     * Получить информацию о группе
     */
    async getGroupInfo(groupId: number): Promise<{
        id: number;
        position: { x: number; y: number };
        taskIds: number[];
        taskCount: number;
    }> {
        const response = await api.get(`/task-positions/group/${groupId}`);
        return response.data;
    },
};