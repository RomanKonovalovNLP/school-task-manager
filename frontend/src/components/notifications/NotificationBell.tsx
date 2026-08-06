import React, { useState, useEffect } from 'react';
import {
    IconButton,
    Badge,
    Popover,
    List,
    ListItemButton,
    ListItemText,
    Box,
    Typography,
    Divider,
    Button,
    Chip,
    Tooltip,
    alpha,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EventIcon from '@mui/icons-material/Event';
import TaskIcon from '@mui/icons-material/Task';
import InsightsIcon from '@mui/icons-material/Insights';
import { useNotifications } from '../../hooks/useNotifications';
import { useAppDispatch } from '../../hooks/useRedux';
import { setSelectedTask } from '../../store/slices/tasksSlice';
import { tasksService } from '../../services/tasks.service';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * ✅ ИСПРАВЛЕНИЕ: Функция для корректного парсинга даты
 * 
 * Проблема была в том, что бэкенд возвращал дату без timezone (например "2024-01-15T10:30:00.000")
 * а JavaScript интерпретировал её как локальное время.
 * 
 * Теперь бэкенд возвращает ISO строку с 'Z' (UTC), но на всякий случай
 * делаем проверку и добавляем 'Z' если его нет.
 */
const parseNotificationDate = (dateString: string): Date => {
    if (!dateString) {
        return new Date();
    }
    
    // Если строка уже содержит timezone информацию - парсим как есть
    if (dateString.endsWith('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
        return new Date(dateString);
    }
    
    // Если нет timezone - добавляем 'Z' (UTC)
    return new Date(dateString + 'Z');
};

/**
 * Форматирует время относительно текущего момента
 */
const formatNotificationTime = (dateString: string): string => {
    try {
        const date = parseNotificationDate(dateString);
        
        // Проверяем валидность даты
        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', dateString);
            return 'недавно';
        }
        
        return formatDistanceToNow(date, {
            addSuffix: true,
            locale: ru,
        });
    } catch (error) {
        console.error('Error formatting notification time:', error, dateString);
        return 'недавно';
    }
};

/**
 * Определяет тип уведомления (задача или мероприятие)
 */
const getNotificationType = (notificationType: string): 'task' | 'event' | 'digest' => {
    if (notificationType === 'weekly_digest') {
        return 'digest';
    }
    if (notificationType.startsWith('event') || notificationType.includes('event')) {
        return 'event';
    }
    return 'task';
};

export const NotificationBell: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useNotifications();
    const dispatch = useAppDispatch();

    // Визуальная индикация при получении нового уведомления
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        if (unreadCount > 0) {
            setPulse(true);
            setTimeout(() => setPulse(false), 1000);
        }
    }, [unreadCount]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // Открытие задачи или мероприятия при клике на уведомление
    const handleNotificationClick = async (notification: any) => {
        markAsRead(notification.id);
        
        const type = getNotificationType(notification.notificationType);
        
        if (type === 'task' && notification.taskId) {
            try {
                // Загружаем полные данные задачи
                const task = await tasksService.getById(notification.taskId);
                // Устанавливаем выбранную задачу для открытия модалки
                dispatch(setSelectedTask(task));
            } catch (error) {
                console.error('Failed to load task:', error);
            }
        } else if (type === 'event' && notification.eventId) {
            // TODO: Открыть мероприятие
            // Пока просто переходим на страницу мероприятий
            window.location.href = '/events';
        }
        
        handleClose();
    };

    const open = Boolean(anchorEl);

    return (
        <>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                {/* Индикатор подключения */}
                {!isConnected && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'error.main',
                            zIndex: 1,
                        }}
                    />
                )}

                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    sx={{
                        animation: pulse ? 'pulse 1s ease-in-out' : 'none',
                        '@keyframes pulse': {
                            '0%': { transform: 'scale(1)' },
                            '50%': { transform: 'scale(1.1)' },
                            '100%': { transform: 'scale(1)' },
                        },
                    }}
                >
                    <Badge
                        badgeContent={unreadCount}
                        color="error"
                        max={99}
                    >
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Box>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <Box sx={{ width: 400, maxHeight: 600 }}>
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            bgcolor: 'primary.main',
                            color: 'white',
                        }}
                    >
                        <Typography variant="h6">Уведомления</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* Статус подключения */}
                            <Chip
                                label={isConnected ? 'Онлайн' : 'Офлайн'}
                                size="small"
                                sx={{
                                    bgcolor: isConnected ? 'success.main' : 'error.main',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                }}
                            />
                            {unreadCount > 0 && (
                                <Chip
                                    label={`${unreadCount} новых`}
                                    size="small"
                                    sx={{
                                        bgcolor: 'error.main',
                                        color: 'white',
                                    }}
                                />
                            )}
                        </Box>
                    </Box>

                    <Divider />

                    <List sx={{ maxHeight: 500, overflow: 'auto', p: 0 }}>
                        {notifications.length === 0 ? (
                            <Box
                                sx={{
                                    p: 4,
                                    textAlign: 'center',
                                    color: 'text.secondary',
                                }}
                            >
                                <NotificationsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                                <Typography variant="body2">
                                    Нет уведомлений
                                </Typography>
                            </Box>
                        ) : (
                            notifications.map((notification) => {
                                const type = getNotificationType(notification.notificationType);
                                
                                return (
                                    <ListItemButton
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        sx={(theme) => {
                                            // Подсветка непрочитанных строится от цвета темы,
                                            // иначе в тёмном режиме получаются светлые полосы.
                                            const accent = type === 'event'
                                                ? theme.palette.warning.main
                                                : theme.palette.primary.main;
                                            const strength = theme.palette.mode === 'dark' ? 0.18 : 0.1;
                                            return {
                                                backgroundColor: notification.isRead
                                                    ? 'transparent'
                                                    : alpha(accent, strength),
                                                borderLeft: notification.isRead
                                                    ? 'none'
                                                    : '4px solid',
                                                borderLeftColor: accent,
                                                '&:hover': {
                                                    backgroundColor: notification.isRead
                                                        ? theme.palette.action.hover
                                                        : alpha(accent, strength + 0.1),
                                                },
                                                py: 1.5,
                                            };
                                        }}
                                    >
                                        {/* Иконка типа */}
                                        <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center' }}>
                                            {type === 'event' ? (
                                                <EventIcon color="warning" fontSize="small" />
                                            ) : type === 'digest' ? (
                                                <InsightsIcon color="success" fontSize="small" />
                                            ) : (
                                                <TaskIcon color="primary" fontSize="small" />
                                            )}
                                        </Box>
                                        
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: notification.isRead ? 400 : 600,
                                                    }}
                                                >
                                                    {notification.message}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatNotificationTime(notification.createdAt)}
                                                    </Typography>
                                                    {!notification.isRead && (
                                                        <Chip
                                                            label="Новое"
                                                            size="small"
                                                            color={type === 'event' ? 'warning' : 'primary'}
                                                            sx={{ height: 16, fontSize: '0.65rem' }}
                                                        />
                                                    )}
                                                </Box>
                                            }
                                        />

                                        {/* Отметить прочитанным, не открывая задачу/мероприятие */}
                                        {!notification.isRead && (
                                            <Tooltip title="Отметить прочитанным">
                                                <IconButton
                                                    size="small"
                                                    edge="end"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(notification.id);
                                                    }}
                                                    sx={{ ml: 1 }}
                                                >
                                                    <DoneIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </ListItemButton>
                                );
                            })
                        )}
                    </List>

                    {notifications.length > 0 && (
                        <>
                            <Divider />
                            <Box
                                sx={{
                                    p: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Button
                                    size="small"
                                    startIcon={<DoneAllIcon />}
                                    disabled={unreadCount === 0}
                                    onClick={markAllAsRead}
                                >
                                    Прочитать все
                                </Button>
                                <Button size="small" onClick={handleClose}>
                                    Закрыть
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            </Popover>
        </>
    );
};

export default NotificationBell;
