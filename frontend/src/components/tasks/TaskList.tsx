import React, { useState } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import TaskCard from './TaskCard';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { setSelectedTask, removeTask } from '../../store/slices/tasksSlice';
import { tasksService } from '../../services/tasks.service';

interface TaskListProps {
    onRefresh: () => void;
}

const TaskList: React.FC<TaskListProps> = ({ onRefresh }) => {
    const { tasks, loading, error } = useAppSelector((state) => state.tasks);
    const dispatch = useAppDispatch();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<number | null>(null);

    const handleTaskClick = (taskId: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
            dispatch(setSelectedTask(task));
        }
    };

    const handleDeleteClick = (taskId: number) => {
        setTaskToDelete(taskId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete) {
            try {
                await tasksService.delete(taskToDelete);
                dispatch(removeTask(taskToDelete));
                setDeleteDialogOpen(false);
                setTaskToDelete(null);
            } catch (error: any) {
                console.error('Failed to delete task:', error);
                alert(error.response?.data?.message || 'Ошибка при удалении задачи');
            }
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '200px',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
        );
    }

    if (tasks.length === 0) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '200px',
                }}
            >
                <Typography variant="h6" color="text.secondary">
                    Нет задач
                </Typography>
            </Box>
        );
    }

    return (
        <>
            <Box>
                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => handleTaskClick(task.id)}
                        onDelete={() => handleDeleteClick(task.id)}
                    />
                ))}
            </Box>

            {/* Диалог подтверждения удаления */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Подтверждение удаления</DialogTitle>
                <DialogContent>
                    Вы уверены, что хотите удалить эту задачу?
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default TaskList;