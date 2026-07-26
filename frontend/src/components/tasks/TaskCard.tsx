import React from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    IconButton,
    Tooltip,
    Checkbox,
} from '@mui/material';
import {
    Visibility,
    Delete,
    Edit,
    AccessTime,
    Person,
    Folder,
    Star,
    Repeat,
    Bolt,
    CheckCircle,
    RadioButtonUnchecked,
    Lock,
    PersonPin,
} from '@mui/icons-material';
import { Task } from '../../types';
import {
    getPriorityLabel,
    formatDeadline,
    getTaskColor,
    isTaskDoneFor,
    COMPLETED_COLOR,
} from '../../utils/taskHelpers';
import { useAppSelector } from '../../hooks/useRedux';

interface TaskCardProps {
    task: Task;
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onGroupClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onAddToToday?: () => void;
    onToggleComplete?: () => void;
    groupName?: string;
    selectable?: boolean;
    selected?: boolean;
    onSelectToggle?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
    task,
    onClick,
    onDelete,
    onEdit,
    onGroupClick,
    onAddToToday,
    onToggleComplete,
    groupName,
    selectable,
    selected,
    onSelectToggle,
}) => {
    const { user } = useAppSelector((state) => state.auth);
    // Выполненная задача подсвечивается зелёным, остальные — по приоритету.
    // Для создателя и админа «выполнена» = отметили все назначенные.
    const isDone = isTaskDoneFor(task, user);
    const priorityColor = getTaskColor(task, user);
    // ИСПРАВЛЕНО (#3): владение определяется по creatorName, как на backend.
    // Раньше сравнивалось task.creatorId === user.id, но backend не возвращает
    // поле id, а creatorId (sessionId) меняется после каждого logout.
    const canEdit = user?.isAdmin || task.creatorName === user?.fullName;
    // Адресована ли задача лично текущему пользователю
    const assignedUsers = (task.assigneeUsers && task.assigneeUsers.length > 0
        ? task.assigneeUsers
        : (task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser as string) || []));
    const isAssignedPersonally = !!user && assignedUsers.includes(user.fullName);

    return (
        <Card
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: `4px solid ${priorityColor}`,
                outline: selected ? '2px solid #1976d2' : 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                },
            }}
            onClick={selectable ? () => onSelectToggle && onSelectToggle() : onClick}
        >
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                {/* Заголовок и статус */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1,
                    }}
                >
                    {selectable && (
                        <Checkbox checked={!!selected} size="small" sx={{ p: 0, mr: 1 }} onClick={(e) => e.stopPropagation()} onChange={() => onSelectToggle && onSelectToggle()} />
                    )}
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, pr: 2 }}>
                        {task.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {task.recurrence && (
                            <Tooltip title="Повторяющаяся задача"><Repeat fontSize="small" sx={{ color: 'text.secondary' }} /></Tooltip>
                        )}
                        {task.isImportant && (
                            <Tooltip title="Важная"><Star fontSize="small" sx={{ color: '#ffb300' }} /></Tooltip>
                        )}
                        <Chip
                            icon={isDone ? <CheckCircle sx={{ fontSize: '0.9rem', color: 'white !important' }} /> : undefined}
                            label={
                                isDone
                                    ? (user?.isAdmin || task.creatorName === user?.fullName) && (task.expectedCount ?? 0) > 0
                                        ? `Выполнено ${task.completionCount}/${task.expectedCount}`
                                        : 'Выполнено'
                                    : getPriorityLabel(task.priority)
                            }
                            size="small"
                            sx={{ backgroundColor: priorityColor, color: 'white', fontWeight: 'bold' }}
                        />
                    </Box>
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

                {/* Ход выполнения — виден создателю задачи и админу */}
                {canEdit && !isDone && (task.expectedCount ?? 0) > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CheckCircle sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                            Выполнили {task.completionCount ?? 0} из {task.expectedCount}
                        </Typography>
                    </Box>
                )}

                {/* Категории и адресаты */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {/* Личная задача — раньше у неё на карточке не было ни одного признака */}
                    {task.isPersonal && (
                        <Chip
                            icon={<Lock sx={{ fontSize: '0.9rem' }} />}
                            label="Личная"
                            size="small"
                            color="info"
                            variant="outlined"
                        />
                    )}
                    {/* Задача адресована лично текущему пользователю */}
                    {!task.isPersonal && isAssignedPersonally && (
                        <Chip
                            icon={<PersonPin sx={{ fontSize: '0.9rem' }} />}
                            label="Персонально вам"
                            size="small"
                            color="secondary"
                        />
                    )}
                    {groupName && (
                        <Chip
                            icon={<Folder sx={{ fontSize: '0.9rem' }} />}
                            label={groupName}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    )}
                    {(task.assigneeCategories && task.assigneeCategories.length > 0
                        ? task.assigneeCategories
                        : (task.assignees?.filter((a: any) => a.assigneeCategory).map((a: any) => a.assigneeCategory) || [])
                    ).map((category: string) => (
                        <Chip key={`c-${category}`} label={category} size="small" variant="outlined" />
                    ))}
                    {(task.assigneeUsers && task.assigneeUsers.length > 0
                        ? task.assigneeUsers
                        : (task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser) || [])
                    ).map((u: string) => (
                        <Chip key={`u-${u}`} icon={<Person sx={{ fontSize: '0.9rem' }} />} label={u} size="small" color="secondary" variant="outlined" />
                    ))}
                </Box>

                {/* Действия */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Отметка о выполнении прямо на карточке */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {onToggleComplete && (
                            <Tooltip
                                title={
                                    task.isCompletedByUser
                                        ? 'Снять отметку о выполнении'
                                        : 'Отметить выполненной'
                                }
                            >
                                <Checkbox
                                    size="small"
                                    sx={{ p: 0.5 }}
                                    checked={!!task.isCompletedByUser}
                                    icon={<RadioButtonUnchecked fontSize="small" />}
                                    checkedIcon={<CheckCircle fontSize="small" sx={{ color: COMPLETED_COLOR }} />}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={onToggleComplete}
                                />
                            </Tooltip>
                        )}

                        {/* Просмотры */}
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Visibility sx={{ fontSize: '1rem', mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                                {task.viewsCount}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Кнопки действий */}
                    <Box>
                        {onAddToToday && (
                            <Tooltip title="В план на сегодня">
                                <IconButton size="small" color="primary" onClick={onAddToToday}>
                                    <Bolt fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        {onGroupClick && (
                            <Tooltip title="Группа">
                                <IconButton size="small" onClick={onGroupClick}>
                                    <Folder fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
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