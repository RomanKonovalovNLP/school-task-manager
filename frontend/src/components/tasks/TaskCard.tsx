import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Visibility,
    Delete,
    Edit,
    AccessTime,
    Person,
} from '@mui/icons-material';
import { Task } from '../../types';
import {
    getPriorityColor,
    getPriorityLabel,
    formatDeadline,
} from '../../utils/taskHelpers';
import { useAppSelector } from '../../hooks/useRedux';

interface TaskCardProps {
    task: Task;
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onDelete?: () => void;
    onEdit?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    onClick,
    onDelete,
    onEdit,
}) => {
    const { user } = useAppSelector((state) => state.auth);
    const priorityColor = getPriorityColor(task.priority);
    const canEdit = user?.isAdmin || task.creatorName === user?.fullName;

    return (
        <Card
            sx={{
                mb: 2,
                borderLeft: `4px solid ${priorityColor}`,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                },
            }}
            onClick={onClick}
        >
            <CardContent>
                {/* Заголовок и статус */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                    }}
                >
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, pr: 2 }}>
                        {task.title}
                    </Typography>
                    <Chip
                        label={getPriorityLabel(task.priority)}
                        size="small"
                        sx={{
                            backgroundColor: priorityColor,
                            color: 'white',
                            fontWeight: 'bold',
                        }}
                    />
                </Box>

                {/* Описание (первые 100 символов) */}
                {task.description && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {task.description}
                    </Typography>
                )}

                {/* Дедлайн */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccessTime sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                        {formatDeadline(task.deadline)}
                    </Typography>
                </Box>

                {/* Создатель */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Person sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                        {task.creatorName}
                    </Typography>
                </Box>

                {/* Категории */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {task.assignees && task.assignees.length > 0 ? (
                        task.assignees.map((assignee) => (
                            <Chip
                                key={assignee.id}
                                label={assignee.assigneeCategory}
                                size="small"
                                variant="outlined"
                            />
                        ))
                    ) : (
                        task.assigneeCategories?.map((category) => (
                            <Chip
                                key={category}
                                label={category}
                                size="small"
                                variant="outlined"
                            />
                        ))
                    )}
                </Box>

                {/* Действия */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Просмотры */}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Visibility sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                            {task.viewsCount}
                        </Typography>
                    </Box>

                    {/* Кнопки действий */}
                    <Box>
                        {canEdit && onEdit && (
                            <Tooltip title="Редактировать">
                                <IconButton size="small" onClick={onEdit}>
                                    <Edit fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {canEdit && onDelete && (
                            <Tooltip title="Удалить">
                                <IconButton size="small" color="error" onClick={onDelete}>
                                    <Delete fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default TaskCard;