import { useState, useCallback, useRef } from 'react';
import { detectCollisions, findBestCollisionTarget, TaskRect } from '../utils/collisionDetection';
import { useTaskPositions } from './useTaskPositions';

interface DragState {
    isDragging: boolean;
    taskId: number | null;
    startPosition: { x: number; y: number };
    currentPosition: { x: number; y: number };
    offset: { x: number; y: number };
    collidingTaskIds: number[];
}

export const useDragAndDrop = (
    tasks: any[],
    taskDimensions: { width: number; height: number }
) => {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        taskId: null,
        startPosition: { x: 0, y: 0 },
        currentPosition: { x: 0, y: 0 },
        offset: { x: 0, y: 0 },
        collidingTaskIds: []
    });

    const { updateTaskPosition, createTaskGroup, addTaskToGroup } = useTaskPositions();
    const draggedTaskRef = useRef<HTMLDivElement | null>(null);

    /**
     * Начало перетаскивания
     */
    const handleDragStart = useCallback((
        taskId: number,
        initialPosition: { x: number; y: number },
        mousePosition: { x: number; y: number }
    ) => {
        const offset = {
            x: mousePosition.x - initialPosition.x,
            y: mousePosition.y - initialPosition.y
        };

        setDragState({
            isDragging: true,
            taskId,
            startPosition: initialPosition,
            currentPosition: initialPosition,
            offset,
            collidingTaskIds: []
        });
    }, []);

    /**
     * Процесс перетаскивания
     */
    const handleDrag = useCallback((mousePosition: { x: number; y: number }) => {
        if (!dragState.isDragging || !dragState.taskId) return;

        const newPosition = {
            x: mousePosition.x - dragState.offset.x,
            y: mousePosition.y - dragState.offset.y
        };

        // Создаем прямоугольник для перетаскиваемой таски
        const draggedRect: TaskRect = {
            taskId: dragState.taskId,
            x: newPosition.x,
            y: newPosition.y,
            width: taskDimensions.width,
            height: taskDimensions.height
        };

        // Создаем прямоугольники для остальных тасок
        const otherTaskRects: TaskRect[] = tasks
            .filter(task => task.id !== dragState.taskId)
            .map(task => ({
                taskId: task.id,
                x: task.position?.x || 0,
                y: task.position?.y || 0,
                width: taskDimensions.width,
                height: taskDimensions.height
            }));

        // Проверяем коллизии
        const collisionResult = detectCollisions(draggedRect, otherTaskRects);

        setDragState(prev => ({
            ...prev,
            currentPosition: newPosition,
            collidingTaskIds: collisionResult.collidingTaskIds
        }));
    }, [dragState, tasks, taskDimensions]);

    /**
     * Завершение перетаскивания
     */
    const handleDragEnd = useCallback(async () => {
        if (!dragState.isDragging || !dragState.taskId) return;

        const taskId = dragState.taskId;
        const finalPosition = dragState.currentPosition;
        const collidingIds = dragState.collidingTaskIds;

        // Сбрасываем состояние
        setDragState({
            isDragging: false,
            taskId: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
            collidingTaskIds: []
        });

        if (collidingIds.length > 0) {
            // Есть коллизия - создаем или добавляем в группу
            const draggedTask = tasks.find(t => t.id === taskId);
            const targetTaskId = collidingIds[0]; // берем первую таску с коллизией
            const targetTask = tasks.find(t => t.id === targetTaskId);

            if (targetTask?.groupId) {
                // Целевая таска уже в группе - добавляем к ней
                await addTaskToGroup(targetTask.groupId, taskId);
            } else {
                // Создаем новую группу
                await createTaskGroup([targetTaskId, taskId], finalPosition);
            }
        } else {
            // Нет коллизии - просто обновляем позицию
            await updateTaskPosition(taskId, finalPosition);
        }
    }, [dragState, tasks, updateTaskPosition, createTaskGroup, addTaskToGroup]);

    /**
     * Отмена перетаскивания (например, по Escape)
     */
    const handleDragCancel = useCallback(() => {
        setDragState({
            isDragging: false,
            taskId: null,
            startPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
            collidingTaskIds: []
        });
    }, []);

    return {
        dragState,
        handleDragStart,
        handleDrag,
        handleDragEnd,
        handleDragCancel
    };
};