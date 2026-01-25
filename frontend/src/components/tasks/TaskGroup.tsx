import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Box,
    Typography,
    Button,
    Chip,
    Divider,
} from '@mui/material';
import { Close, RemoveCircleOutline, Visibility } from '@mui/icons-material';
import { Task, TaskPosition } from '../../types';
import { getPriorityColor, formatDeadline } from '../../utils/taskHelpers';

interface TaskGroupProps {
    open: boolean;
    onClose: () => void;
    groupId: number;
    tasks: Task[];
    positions: TaskPosition[];
    onRemoveFromGroup: (taskId: number) => void;
    onUngroupAll: () => void;
    onTaskClick: (taskId: number) => void;
}

const TaskGroup: React.FC<TaskGroupProps> = ({
    open,
    onClose,
    groupId,
    tasks,
    positions,
    onRemoveFromGroup,
    onUngroupAll,
    onTaskClick,
}) => {
    // Получаем таски группы, отсортированные по z-index (верхняя - последняя)
    const groupTaskIds = positions
        .filter((p) => p.groupId === groupId)
        .sort((a, b) => b.zIndex - a.zIndex)
        .map((p) => p.taskId);

    const groupTasks = tasks.filter((t) => groupTaskIds.includes(t.id));

    // Статистика по группе
    const urgentCount = groupTasks.filter((t) => t.priority === 'urgent').length;
    const mediumCount = groupTasks.filter((t) => t.priority === 'medium').length;
    const lowCount = groupTasks.filter((t) => t.priority === 'low').length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Box>
                        <Typography variant="h6">
                            Группа задач ({groupTasks.length})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {urgentCount > 0 && (
                                <Chip
                                    label={`Срочных: ${urgentCount}`}
                                    size="small"
                                    sx={{
                                        backgroundColor: '#FF4444',
                                        color: 'white',
                                    }}
                                />
                            )}
                            {mediumCount > 0 && (
                                <Chip
                                    label={`Средних: ${mediumCount}`}
                                    size="small"
                                    sx={{
                                        backgroundColor: '#FFA500',
                                        color: 'white',
                                    }}
                                />
                            )}
                            {lowCount > 0 && (
                                <Chip
                                    label={`Обычных: ${lowCount}`}
                                    size="small"
                                    sx={{
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                    <IconButton onClick={onClose}>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {groupTasks.map((task, index) => {
                        const position = positions.find((p) => p.taskId === task.id);
                        const viewCount = task.views?.length || 0;

                        return (
                            <React.Fragment key={task.id}>
                                <ListItem
                                    sx={{
                                        border: `2px solid ${getPriorityColor(task.priority)}`,
                                        borderRadius: 1,
                                        mb: 1,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'scale(1.01)',
                                            boxShadow: 2,
                                            backgroundColor: 'rgba(33, 150, 243, 0.05)',
                                        },
                                    }}
                                    onClick={() => {
                                        onTaskClick(task.id);
                                        onClose();
                                    }}
                                    secondaryAction={
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            {viewCount > 0 && (
                                                <Chip
                                                    icon={<Visibility fontSize="small" />}
                                                    label={viewCount}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            <IconButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemoveFromGroup(task.id);
                                                }}
                                                title="Убрать из группы"
                                            >
                                                <RemoveCircleOutline />
                                            </IconButton>
                                        </Box>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {index === 0 && (
                                                    <Typography
                                                        component="span"
                                                        sx={{ fontSize: 20 }}
                                                    >
                                                        📌
                                                    </Typography>
                                                )}
                                                <Typography
                                                    component="span"
                                                    sx={{
                                                        fontWeight: index === 0 ? 600 : 400,
                                                    }}
                                                >
                                                    {task.title}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {formatDeadline(task.deadline)} •{' '}
                                                    {task.creatorName}
                                                </Typography>
                                                {task.description && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            display: 'block',
                                                            mt: 0.5,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {task.description}
                                                    </Typography>
                                                )}
                                                {task.assigneeCategories &&
                                                    task.assigneeCategories.length > 0 && (
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                gap: 0.5,
                                                                mt: 0.5,
                                                                flexWrap: 'wrap',
                                                            }}
                                                        >
                                                            {task.assigneeCategories.map((cat) => (
                                                                <Chip
                                                                    key={cat}
                                                                    label={cat}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            ))}
                                                        </Box>
                                                    )}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            </React.Fragment>
                        );
                    })}
                </List>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        Нажмите на задачу для просмотра деталей
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => {
                            onUngroupAll();
                            onClose();
                        }}
                        size="small"
                    >
                        Разгруппировать все
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default TaskGroup;