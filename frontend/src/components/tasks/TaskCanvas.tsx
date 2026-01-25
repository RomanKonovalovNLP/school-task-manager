import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import DraggableTask from './DraggableTask';
import TaskGroup from './TaskGroup';
import { useAppSelector, useAppDispatch } from '../../hooks/useRedux';
import { setSelectedTask, removeTask } from '../../store/slices/tasksSlice';
import { taskPositionsService } from '../../services/task-positions.service';
import { tasksService } from '../../services/tasks.service';
import { TaskPosition, TaskGroup as TaskGroupType } from '../../types';

interface TaskCanvasProps {
    onRefresh: () => void;
}

const TaskCanvas: React.FC<TaskCanvasProps> = ({ onRefresh }) => {
    const { tasks } = useAppSelector((state) => state.tasks);
    const dispatch = useAppDispatch();

    const [positions, setPositions] = useState<TaskPosition[]>([]);
    const [groups, setGroups] = useState<TaskGroupType[]>([]);
    const [loading, setLoading] = useState(true);
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    
    // ИСПРАВЛЕНИЕ: Флаг для предотвращения лишних перезагрузок
    const isInitialLoadRef = useRef(true);
    const lastTasksLengthRef = useRef(0);

    // Загружаем позиции только при первом рендере или при изменении количества задач
    useEffect(() => {
        if (isInitialLoadRef.current || tasks.length !== lastTasksLengthRef.current) {
            loadPositions();
            lastTasksLengthRef.current = tasks.length;
            isInitialLoadRef.current = false;
        }
    }, [tasks.length]);

    const loadPositions = async () => {
        setLoading(true);
        try {
            const data = await taskPositionsService.getAll();
            setPositions(data.positions);
            setGroups(data.groups);
        } catch (error) {
            console.error('Failed to load positions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = useCallback((taskId: number) => {
        // Можно добавить визуальную индикацию
    }, []);

    const handleDrag = useCallback((taskId: number, x: number, y: number) => {
        // ИСПРАВЛЕНИЕ: Оптимистичное обновление позиции локально
        setPositions(prev => prev.map(p => 
            p.taskId === taskId 
                ? { ...p, positionX: x, positionY: y }
                : p
        ));
    }, []);

    const handleDragStop = useCallback(
        async (taskId: number, x: number, y: number) => {
            const overlappingTasks = checkOverlap(taskId, x, y);

            if (overlappingTasks.length > 0) {
                await handleGrouping(taskId, overlappingTasks, x, y);
            } else {
                try {
                    // Сохраняем на сервер без перезагрузки всех позиций
                    await taskPositionsService.updatePosition(taskId, x, y);
                    // НЕ вызываем loadPositions() - позиция уже обновлена локально
                } catch (error) {
                    console.error('Failed to update position:', error);
                    // При ошибке перезагружаем позиции
                    await loadPositions();
                }
            }
        },
        [positions],
    );

    const checkOverlap = (taskId: number, x: number, y: number): number[] => {
        const TASK_WIDTH = 280;
        const TASK_HEIGHT = 200;
        const OVERLAP_THRESHOLD = 0.5;

        const overlapping: number[] = [];

        for (const pos of positions) {
            if (pos.taskId === taskId) continue;

            const overlapX = Math.max(
                0,
                Math.min(x + TASK_WIDTH, pos.positionX + TASK_WIDTH) - Math.max(x, pos.positionX),
            );
            const overlapY = Math.max(
                0,
                Math.min(y + TASK_HEIGHT, pos.positionY + TASK_HEIGHT) - Math.max(y, pos.positionY),
            );

            const overlapArea = overlapX * overlapY;
            const taskArea = TASK_WIDTH * TASK_HEIGHT;
            const overlapPercentage = overlapArea / taskArea;

            if (overlapPercentage >= OVERLAP_THRESHOLD) {
                overlapping.push(pos.taskId);
            }
        }

        return overlapping;
    };

    const handleGrouping = async (
        taskId: number,
        overlappingTaskIds: number[],
        x: number,
        y: number,
    ) => {
        try {
            const overlappingPositions = positions.filter((p) =>
                overlappingTaskIds.includes(p.taskId),
            );

            const existingGroupId = overlappingPositions.find((p) => p.groupId)?.groupId;

            if (existingGroupId) {
                await taskPositionsService.addTaskToGroup(existingGroupId, taskId);
            } else {
                await taskPositionsService.createGroup([taskId, ...overlappingTaskIds], x, y);
            }

            // При группировке нужно перезагрузить позиции
            await loadPositions();
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    };

    const handleTaskClick = useCallback((taskId: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
            dispatch(setSelectedTask(task));
        }
    }, [tasks, dispatch]);

    const handleGroupClick = useCallback((groupId: number) => {
        setSelectedGroupId(groupId);
        setGroupModalOpen(true);
    }, []);

    const handleRemoveFromGroup = async (taskId: number) => {
        if (!selectedGroupId) return;

        try {
            const position = positions.find((p) => p.taskId === taskId);
            if (!position) return;

            const newX = position.positionX + 300;
            const newY = position.positionY;

            await taskPositionsService.removeTaskFromGroup(selectedGroupId, taskId, newX, newY);
            await loadPositions();

            const remainingInGroup = positions.filter(
                (p) => p.groupId === selectedGroupId && p.taskId !== taskId,
            );

            if (remainingInGroup.length <= 1) {
                setGroupModalOpen(false);
                setSelectedGroupId(null);
            }
        } catch (error) {
            console.error('Failed to remove from group:', error);
        }
    };

    const handleUngroupAll = async () => {
        if (!selectedGroupId) return;

        try {
            await taskPositionsService.ungroupTasks(selectedGroupId);
            await loadPositions();
            setGroupModalOpen(false);
            setSelectedGroupId(null);
        } catch (error) {
            console.error('Failed to ungroup:', error);
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (window.confirm('Удалить задачу?')) {
            try {
                await tasksService.delete(taskId);
                dispatch(removeTask(taskId));
                // Удаляем позицию локально
                setPositions(prev => prev.filter(p => p.taskId !== taskId));
            } catch (error: any) {
                alert(error.response?.data?.message || 'Ошибка при удалении');
            }
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (tasks.length === 0) {
        return <Alert severity="info">Нет задач. Создайте новую задачу.</Alert>;
    }

    // Показываем только верхние задачи групп
    const visiblePositions = positions.filter((position) => {
        if (!position.groupId) {
            return true;
        }

        const groupPositions = positions.filter((p) => p.groupId === position.groupId);
        const maxZIndex = Math.max(...groupPositions.map((p) => p.zIndex));
        return position.zIndex === maxZIndex;
    });

    return (
        <>
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    minWidth: 2000,
                    minHeight: 2000,
                    bgcolor: '#f5f5f5',
                    backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                }}
            >
                {visiblePositions.map((position) => {
                    const task = tasks.find((t) => t.id === position.taskId);
                    if (!task) return null;

                    const isInGroup = position.groupId !== null;
                    const groupSize = isInGroup
                        ? positions.filter((p) => p.groupId === position.groupId).length
                        : 0;

                    return (
                        <DraggableTask
                            key={position.taskId}
                            task={task}
                            position={{ x: position.positionX, y: position.positionY }}
                            zIndex={position.zIndex}
                            isInGroup={isInGroup}
                            groupId={position.groupId}
                            groupSize={groupSize}
                            onDragStart={handleDragStart}
                            onDrag={handleDrag}
                            onDragStop={handleDragStop}
                            onClick={() => handleTaskClick(task.id)}
                            onGroupClick={handleGroupClick}
                            onDelete={() => handleDeleteTask(task.id)}
                        />
                    );
                })}
            </Box>

            <TaskGroup
                open={groupModalOpen}
                onClose={() => {
                    setGroupModalOpen(false);
                    setSelectedGroupId(null);
                }}
                groupId={selectedGroupId || 0}
                tasks={tasks}
                positions={positions}
                onRemoveFromGroup={handleRemoveFromGroup}
                onUngroupAll={handleUngroupAll}
                onTaskClick={handleTaskClick}
            />
        </>
    );
};

export default TaskCanvas;
