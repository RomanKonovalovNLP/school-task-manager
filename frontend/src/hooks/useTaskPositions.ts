import { useState, useCallback } from 'react';
import { taskPositionsService } from '../services/task-positions.service';
import { TaskPosition, TaskGroup } from '../types';

interface UseTaskPositionsReturn {
    positions: TaskPosition[];
    groups: TaskGroup[];
    loading: boolean;
    error: string | null;
    updateTaskPosition: (taskId: number, position: { x: number; y: number }) => Promise<void>;
    createTaskGroup: (taskIds: number[], position: { x: number; y: number }) => Promise<void>;
    addTaskToGroup: (groupId: number, taskId: number) => Promise<void>;
    removeTaskFromGroup: (
        groupId: number,
        taskId: number,
        newPosition: { x: number; y: number }
    ) => Promise<void>;
    moveGroup: (groupId: number, position: { x: number; y: number }) => Promise<void>;
    ungroupTasks: (groupId: number) => Promise<void>;
    refreshPositions: () => Promise<void>;
    resetToDefaultLayout: () => Promise<void>;
}

/**
 * Хук для управления позициями тасок на canvas
 */
export const useTaskPositions = (): UseTaskPositionsReturn => {
    const [positions, setPositions] = useState<TaskPosition[]>([]);
    const [groups, setGroups] = useState<TaskGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Загружает все позиции и группы с сервера
     */
    const refreshPositions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await taskPositionsService.getAll();
            setPositions(data.positions);
            setGroups(data.groups);
        } catch (err: any) {
            setError(err.message || 'Ошибка загрузки позиций');
            console.error('Failed to load positions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Обновляет позицию одной таски
     */
    const updateTaskPosition = useCallback(
        async (taskId: number, position: { x: number; y: number }) => {
            try {
                await taskPositionsService.updatePosition(taskId, position.x, position.y);

                // Оптимистичное обновление UI
                setPositions((prev) =>
                    prev.map((p) =>
                        p.taskId === taskId
                            ? { ...p, positionX: position.x, positionY: position.y }
                            : p
                    )
                );
            } catch (err: any) {
                setError(err.message || 'Ошибка обновления позиции');
                console.error('Failed to update position:', err);
                throw err;
            }
        },
        []
    );

    /**
     * Создает новую группу тасок
     */
    const createTaskGroup = useCallback(
        async (taskIds: number[], position: { x: number; y: number }): Promise<void> => {
            try {
                await taskPositionsService.createGroup(
                    taskIds,
                    position.x,
                    position.y
                );

                // Перезагружаем позиции для получения актуальных данных
                await refreshPositions();
            } catch (err: any) {
                setError(err.message || 'Ошибка создания группы');
                console.error('Failed to create group:', err);
                throw err;
            }
        },
        [refreshPositions]
    );

    /**
     * Добавляет таску в существующую группу
     */
    const addTaskToGroup = useCallback(
        async (groupId: number, taskId: number) => {
            try {
                await taskPositionsService.addTaskToGroup(groupId, taskId);
                await refreshPositions();
            } catch (err: any) {
                setError(err.message || 'Ошибка добавления в группу');
                console.error('Failed to add to group:', err);
                throw err;
            }
        },
        [refreshPositions]
    );

    /**
     * Удаляет таску из группы
     */
    const removeTaskFromGroup = useCallback(
        async (
            groupId: number,
            taskId: number,
            newPosition: { x: number; y: number }
        ) => {
            try {
                await taskPositionsService.removeTaskFromGroup(
                    groupId,
                    taskId,
                    newPosition.x,
                    newPosition.y
                );
                await refreshPositions();
            } catch (err: any) {
                setError(err.message || 'Ошибка удаления из группы');
                console.error('Failed to remove from group:', err);
                throw err;
            }
        },
        [refreshPositions]
    );

    /**
     * Перемещает всю группу
     */
    const moveGroup = useCallback(
        async (groupId: number, position: { x: number; y: number }) => {
            try {
                await taskPositionsService.moveGroup(groupId, position.x, position.y);

                // Оптимистичное обновление UI для группы
                setGroups((prev) =>
                    prev.map((g) =>
                        g.id === groupId
                            ? { ...g, positionX: position.x, positionY: position.y }
                            : g
                    )
                );

                // Обновляем позиции тасок в группе
                setPositions((prev) =>
                    prev.map((p) =>
                        p.groupId === groupId
                            ? { ...p, positionX: position.x, positionY: position.y }
                            : p
                    )
                );
            } catch (err: any) {
                setError(err.message || 'Ошибка перемещения группы');
                console.error('Failed to move group:', err);
                throw err;
            }
        },
        []
    );

    /**
     * Разгруппирует все таски в группе
     */
    const ungroupTasks = useCallback(
        async (groupId: number) => {
            try {
                await taskPositionsService.ungroupTasks(groupId);
                await refreshPositions();
            } catch (err: any) {
                setError(err.message || 'Ошибка разгруппировки');
                console.error('Failed to ungroup:', err);
                throw err;
            }
        },
        [refreshPositions]
    );

    /**
     * Сбрасывает все позиции к дефолтному grid layout
     */
    const resetToDefaultLayout = useCallback(async () => {
        try {
            await taskPositionsService.resetToDefaultLayout();
            await refreshPositions();
        } catch (err: any) {
            setError(err.message || 'Ошибка сброса позиций');
            console.error('Failed to reset layout:', err);
            throw err;
        }
    }, [refreshPositions]);

    return {
        positions,
        groups,
        loading,
        error,
        updateTaskPosition,
        createTaskGroup,
        addTaskToGroup,
        removeTaskFromGroup,
        moveGroup,
        ungroupTasks,
        refreshPositions,
        resetToDefaultLayout,
    };
};