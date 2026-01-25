import React, { useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Badge,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemText,
    Chip,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Today,
} from '@mui/icons-material';
import { Event } from '../../services/events.service';

interface EventCalendarProps {
    events: Event[];
    onDateSelect: (date: string, events: Event[]) => void;
    onEventClick: (event: Event) => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/**
 * Преобразует дату в локальную строку YYYY-MM-DD
 * ИСПРАВЛЕНИЕ: Используем локальное время вместо UTC
 */
const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Парсит дату из ISO строки в локальную дату
 * ИСПРАВЛЕНИЕ: Корректная обработка timezone
 */
const parseEventDate = (dateString: string): Date => {
    const date = new Date(dateString);
    return date;
};

/**
 * Проверяет, попадает ли дата в диапазон мероприятия
 */
const isDateInEventRange = (dateStr: string, event: Event): boolean => {
    const checkDate = new Date(dateStr);
    checkDate.setHours(0, 0, 0, 0);
    
    const startDate = parseEventDate(event.startDate || event.eventDate);
    const startDay = new Date(startDate);
    startDay.setHours(0, 0, 0, 0);
    
    // Если есть дата окончания - проверяем диапазон
    if (event.endDate) {
        const endDate = parseEventDate(event.endDate);
        const endDay = new Date(endDate);
        endDay.setHours(23, 59, 59, 999);
        
        return checkDate >= startDay && checkDate <= endDay;
    }
    
    // Если нет даты окончания - проверяем только день начала
    return toLocalDateString(checkDate) === toLocalDateString(startDay);
};

const EventCalendar: React.FC<EventCalendarProps> = ({
    events,
    onDateSelect,
    onEventClick,
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayEventsDialogOpen, setDayEventsDialogOpen] = useState(false);
    const [selectedDayEvents, setSelectedDayEvents] = useState<Event[]>([]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    /**
     * ИСПРАВЛЕНИЕ: Построение карты событий по датам с учётом многодневных мероприятий
     */
    const eventsByDate = useMemo(() => {
        const map = new Map<string, Event[]>();
        
        events.forEach((event) => {
            const startDate = parseEventDate(event.startDate || event.eventDate);
            const endDate = event.endDate ? parseEventDate(event.endDate) : startDate;
            
            // Нормализуем даты к началу дня
            const startDay = new Date(startDate);
            startDay.setHours(0, 0, 0, 0);
            
            const endDay = new Date(endDate);
            endDay.setHours(0, 0, 0, 0);
            
            // Добавляем событие ко всем дням в диапазоне
            const currentDay = new Date(startDay);
            while (currentDay <= endDay) {
                const dateKey = toLocalDateString(currentDay);
                
                if (!map.has(dateKey)) {
                    map.set(dateKey, []);
                }
                
                // Добавляем только если ещё не добавлено
                const existing = map.get(dateKey)!;
                if (!existing.find(e => e.id === event.id)) {
                    existing.push(event);
                }
                
                // Переходим к следующему дню
                currentDay.setDate(currentDay.getDate() + 1);
            }
        });
        
        return map;
    }, [events]);

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleDayClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = eventsByDate.get(dateStr) || [];
        
        setSelectedDate(dateStr);
        
        if (dayEvents.length > 0) {
            setSelectedDayEvents(dayEvents);
            setDayEventsDialogOpen(true);
        }
        
        onDateSelect(dateStr, dayEvents);
    };

    const handleEventSelect = (event: Event) => {
        setDayEventsDialogOpen(false);
        onEventClick(event);
    };

    const calendarDays: (number | null)[] = [];
    
    for (let i = 0; i < startDay; i++) {
        calendarDays.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    const today = new Date();
    const isToday = (day: number) => {
        return (
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear()
        );
    };

    const getDateKey = (day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    /**
     * Определяем позицию дня в многодневном мероприятии
     */
    const getEventPosition = (dateStr: string, event: Event): 'start' | 'middle' | 'end' | 'single' => {
        const startDate = parseEventDate(event.startDate || event.eventDate);
        const endDate = event.endDate ? parseEventDate(event.endDate) : startDate;
        
        const startStr = toLocalDateString(startDate);
        const endStr = toLocalDateString(endDate);
        
        if (startStr === endStr) return 'single';
        if (dateStr === startStr) return 'start';
        if (dateStr === endStr) return 'end';
        return 'middle';
    };

    return (
        <>
            <Paper sx={{ p: 2 }}>
                {/* Заголовок с навигацией */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <IconButton onClick={handlePrevMonth}>
                        <ChevronLeft />
                    </IconButton>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">
                            {MONTHS[month]} {year}
                        </Typography>
                        <Tooltip title="Сегодня">
                            <IconButton size="small" onClick={handleToday}>
                                <Today />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    
                    <IconButton onClick={handleNextMonth}>
                        <ChevronRight />
                    </IconButton>
                </Box>

                {/* Дни недели */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
                    {WEEKDAYS.map((day) => (
                        <Typography
                            key={day}
                            align="center"
                            variant="body2"
                            fontWeight="bold"
                            color="text.secondary"
                        >
                            {day}
                        </Typography>
                    ))}
                </Box>

                {/* Дни месяца */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                    {calendarDays.map((day, index) => {
                        const dateKey = day ? getDateKey(day) : '';
                        const dayEvents = day ? eventsByDate.get(dateKey) || [] : [];
                        const hasEvents = dayEvents.length > 0;
                        const isSelected = dateKey === selectedDate;
                        
                        // Проверяем есть ли многодневные мероприятия
                        const hasMultiDayEvents = dayEvents.some(e => e.endDate);

                        return (
                            <Box
                                key={index}
                                onClick={() => day && handleDayClick(day)}
                                sx={{
                                    aspectRatio: '1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 1,
                                    cursor: day ? 'pointer' : 'default',
                                    bgcolor: isSelected
                                        ? 'primary.light'
                                        : day && isToday(day)
                                            ? 'action.selected'
                                            : 'transparent',
                                    border: hasEvents ? '2px solid' : '1px solid transparent',
                                    borderColor: hasEvents 
                                        ? hasMultiDayEvents 
                                            ? 'primary.main' 
                                            : 'error.main' 
                                        : 'transparent',
                                    '&:hover': day ? {
                                        bgcolor: 'action.hover',
                                    } : {},
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                }}
                            >
                                {day && (
                                    <>
                                        <Typography
                                            variant="body2"
                                            fontWeight={isToday(day) ? 'bold' : 'normal'}
                                            color={hasEvents ? 'error.main' : 'text.primary'}
                                        >
                                            {day}
                                        </Typography>
                                        {hasEvents && (
                                            <Badge
                                                badgeContent={dayEvents.length}
                                                color={hasMultiDayEvents ? 'primary' : 'error'}
                                                sx={{ mt: 0.5 }}
                                            >
                                                <Box sx={{ width: 8, height: 8 }} />
                                            </Badge>
                                        )}
                                    </>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                {/* Легенда */}
                <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, border: '2px solid', borderColor: 'error.main', borderRadius: 0.5 }} />
                        <Typography variant="caption">Мероприятия</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, border: '2px solid', borderColor: 'primary.main', borderRadius: 0.5 }} />
                        <Typography variant="caption">Многодневные</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: 'action.selected', borderRadius: 0.5 }} />
                        <Typography variant="caption">Сегодня</Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Диалог со списком мероприятий на день */}
            <Dialog
                open={dayEventsDialogOpen}
                onClose={() => setDayEventsDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Мероприятия на {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </DialogTitle>
                <DialogContent>
                    <List>
                        {selectedDayEvents.map((event) => {
                            const position = selectedDate ? getEventPosition(selectedDate, event) : 'single';
                            const startDate = parseEventDate(event.startDate || event.eventDate);
                            const endDate = event.endDate ? parseEventDate(event.endDate) : null;
                            
                            return (
                                <ListItemButton
                                    key={event.id}
                                    onClick={() => handleEventSelect(event)}
                                    sx={{ 
                                        borderRadius: 1, 
                                        mb: 1, 
                                        border: '1px solid', 
                                        borderColor: 'divider',
                                        borderLeft: '4px solid',
                                        borderLeftColor: position === 'single' ? 'error.main' : 'primary.main',
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {event.title}
                                                {position !== 'single' && (
                                                    <Chip 
                                                        label={
                                                            position === 'start' ? 'Начало' : 
                                                            position === 'end' ? 'Окончание' : 
                                                            'Продолжение'
                                                        } 
                                                        size="small" 
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ height: 20, fontSize: 10 }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {event.allDay ? 'Весь день' : startDate.toLocaleTimeString('ru-RU', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                    {endDate && (
                                                        <>
                                                            {' — '}
                                                            {event.allDay 
                                                                ? endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                                                                : endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                                                            }
                                                        </>
                                                    )}
                                                    {' • '}
                                                    {event.creatorName}
                                                </Typography>
                                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {event.assigneeCategories?.slice(0, 3).map((cat) => (
                                                        <Chip
                                                            key={cat}
                                                            label={cat}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: 11 }}
                                                        />
                                                    ))}
                                                    {event.assigneeCategories && event.assigneeCategories.length > 3 && (
                                                        <Chip
                                                            label={`+${event.assigneeCategories.length - 3}`}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: 11 }}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        }
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default EventCalendar;
