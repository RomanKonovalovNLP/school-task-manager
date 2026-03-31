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

const INITIAL_DRAG_STATE: DragState = {
    isDragging: false,
    taskId: null,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    collidingTaskIds: []
};

export const useDragAndDrop = (
    tasks: any[],
    taskDimensions: { width: number; height: number }
) => {
    const [dragState, setDragState] = useState<DragState>({ ...INITIAL_DRAG_STATE });

    // F20: Используем ref для доступа к актуальному dragState без пересоздания колбека
    const dragStateRef = useRef<DragState>(dragState);
    dragStateRef.current = dragState;

    const tasksRef = useRef(tasks);
    tasksRef.current = tasks;

    const { updateTaskPosition, createTaskGroup, addTaskToGroup } = useTaskPositions();
    const draggedTaskRef = useRef<HTMLDivElement | null>(null);

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

    // F20: handleDrag теперь читает из ref, не зависит от dragState в замыкании
    const handleDrag = useCallback((mousePosition: { x: number; y: number }) => {
        const current = dragStateRef.current;
        if (!current.isDragging || !current.taskId) return;

        const newPosition = {
            x: mousePosition.x - current.offset.x,
            y: mousePosition.y - current.offset.y
        };

        const draggedRect: TaskRect = {
            taskId: current.taskId,
            x: newPosition.x,
            y: newPosition.y,
            width: taskDimensions.width,
            height: taskDimensions.height
        };

        const otherTaskRects: TaskRect[] = tasksRef.current
            .filter(task => task.id !== current.taskId)
            .map(task => ({
                taskId: task.id,
                x: task.position?.x || 0,
                y: task.position?.y || 0,
                width: taskDimensions.width,
                height: taskDimensions.height
            }));

        const collisionResult = detectCollisions(draggedRect, otherTaskRects);

        setDragState(prev => ({
            ...prev,
            currentPosition: newPosition,
            collidingTaskIds: collisionResult.collidingTaskIds
        }));
    }, [taskDimensions]); // F20: Теперь зависит только от taskDimensions

    const handleDragEnd = useCallback(async () => {
        const current = dragStateRef.current;
        if (!current.isDragging || !current.taskId) return;

        const taskId = current.taskId;
        const finalPosition = current.currentPosition;
        const collidingIds = current.collidingTaskIds;

        setDragState({ ...INITIAL_DRAG_STATE });

        if (collidingIds.length > 0) {
            const targetTaskId = collidingIds[0];
            const targetTask = tasksRef.current.find(t => t.id === targetTaskId);

            if (targetTask?.groupId) {
                await addTaskToGroup(targetTask.groupId, taskId);
            } else {
                await createTaskGroup([targetTaskId, taskId], finalPosition);
            }
        } else {
            await updateTaskPosition(taskId, finalPosition);
        }
    }, [updateTaskPosition, createTaskGroup, addTaskToGroup]);

    const handleDragCancel = useCallback(() => {
        setDragState({ ...INITIAL_DRAG_STATE });
    }, []);

    return {
        dragState,
        handleDragStart,
        handleDrag,
        handleDragEnd,
        handleDragCancel
    };
};