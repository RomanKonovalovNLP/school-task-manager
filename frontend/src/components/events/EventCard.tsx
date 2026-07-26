import React from 'react';
import {
    Card,
    CardContent,
    CardActions,
    Typography,
    Box,
    Chip,
    Tooltip,
    LinearProgress,
} from '@mui/material';
import {
    AccessTime,
    AttachFile,
    Task,
    DateRange,
    LocationOn,
    Person,
} from '@mui/icons-material';
import { Event } from '../../services/events.service';
import { getEventStatus, getEventColor, getEventStatusLabel } from '../../utils/eventHelpers';

interface EventCardProps {
    event: Event;
    onClick: () => void;
}

/**
 * Форматирование даты/времени мероприятия
 */
const formatEventDateTime = (event: Event): string => {
    const startDate = new Date(event.startDate || event.eventDate);
    const endDate = event.endDate ? new Date(event.endDate) : null;
    
    const dateOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
    };

    // Весь день
    if (event.allDay) {
        if (endDate && startDate.toDateString() !== endDate.toDateString()) {
            return `${startDate.toLocaleDateString('ru-RU', dateOptions)} - ${endDate.toLocaleDateString('ru-RU', dateOptions)}`;
        }
        return startDate.toLocaleDateString('ru-RU', dateOptions);
    }

    // С конкретным временем
    if (endDate) {
        // В один день
        if (startDate.toDateString() === endDate.toDateString()) {
            return `${startDate.toLocaleDateString('ru-RU', dateOptions)}, ${startDate.toLocaleTimeString('ru-RU', timeOptions)} - ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
        }
        // Несколько дней
        return `${startDate.toLocaleDateString('ru-RU', dateOptions)} ${startDate.toLocaleTimeString('ru-RU', timeOptions)} - ${endDate.toLocaleDateString('ru-RU', dateOptions)} ${endDate.toLocaleTimeString('ru-RU', timeOptions)}`;
    }

    // Только время начала
    return `${startDate.toLocaleDateString('ru-RU', dateOptions)} в ${startDate.toLocaleTimeString('ru-RU', timeOptions)}`;
};

const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
    const startDate = new Date(event.startDate || event.eventDate);
    const endDate = event.endDate ? new Date(event.endDate) : null;

    // Определяем статус мероприятия (учитывает «весь день»: такое мероприятие
    // считается прошедшим только после конца своего дня, а не сразу после полуночи)
    const { isPast, isOngoing, isToday } = getEventStatus(event);
    // Единая с задачами цветовая шкала: зелёный — завершено, красный — сегодня,
    // оранжевый — на днях, синий — впереди
    const eventColor = getEventColor(event);
    const statusLabel = getEventStatusLabel(event);
    const isMultiDay = endDate && startDate.toDateString() !== endDate.toDateString();

    const tasksProgress = event.tasksCount
        ? ((event.completedTasksCount || 0) / event.tasksCount) * 100
        : 0;

    return (
        <Card
            onClick={onClick}
            sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isPast ? 0.75 : 1,
                borderLeft: `4px solid ${eventColor}`,
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                },
            }}
        >
            <CardContent>
                <Typography variant="h6" gutterBottom noWrap>
                    {event.title}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {isMultiDay ? (
                        <DateRange fontSize="small" color="action" />
                    ) : (
                        <AccessTime fontSize="small" color="action" />
                    )}
                    <Typography variant="body2" color="text.secondary">
                        {formatEventDateTime(event)}
                    </Typography>
                    
                    {/* Статусные чипы */}
                    {event.allDay && (
                        <Chip label="Весь день" size="small" variant="outlined" />
                    )}
                    <Chip
                        label={statusLabel}
                        size="small"
                        sx={{ backgroundColor: eventColor, color: '#fff', fontWeight: 'bold' }}
                    />
                </Box>

                {event.location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary" noWrap>
                            {event.location}
                        </Typography>
                    </Box>
                )}

                {event.description && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}
                    >
                        {event.description}
                    </Typography>
                )}

                {/* Категории */}
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                    {event.assigneeCategories?.slice(0, 3).map((cat) => (
                        <Chip
                            key={cat}
                            label={cat}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11 }}
                        />
                    ))}
                    {event.assigneeCategories?.length > 3 && (
                        <Chip
                            label={`+${event.assigneeCategories.length - 3}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: 11 }}
                        />
                    )}
                    {event.assigneeUsers?.slice(0, 3).map((u) => (
                        <Chip key={`u-${u}`} icon={<Person sx={{ fontSize: '0.85rem' }} />} label={u} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    ))}
                    {(event.assigneeUsers?.length || 0) > 3 && (
                        <Chip label={`+${(event.assigneeUsers?.length || 0) - 3}`} size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    )}
                </Box>

                {/* Прогресс задач */}
                {(event.tasksCount ?? 0) > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                                Задачи: {event.completedTasksCount || 0}/{event.tasksCount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {Math.round(tasksProgress)}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={tasksProgress}
                            sx={{ height: 4, borderRadius: 2 }}
                        />
                    </Box>
                )}
            </CardContent>

            <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                    {event.creatorName}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {(event.attachmentsCount ?? 0) > 0 && (
                        <Tooltip title={`${event.attachmentsCount} вложений`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AttachFile fontSize="small" color="action" />
                                <Typography variant="caption">{event.attachmentsCount}</Typography>
                            </Box>
                        </Tooltip>
                    )}
                    {(event.tasksCount ?? 0) > 0 && (
                        <Tooltip title={`${event.tasksCount} задач`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Task fontSize="small" color="action" />
                                <Typography variant="caption">{event.tasksCount}</Typography>
                            </Box>
                        </Tooltip>
                    )}
                </Box>
            </CardActions>
        </Card>
    );
};

export default EventCard;
