import React, { useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
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
    AccessTime,
    Person,
} from '@mui/icons-material';
import { Task } from '../../types';
import { getPriorityColor, getPriorityLabel, getTaskColor, isTaskDoneFor } from '../../utils/taskHelpers';
import { useAppSelector } from '../../hooks/useRedux';

interface TaskCalendarProps {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Приоритет по «остроте»: чем меньше число, тем важнее (для выбора цвета дня)
const PRIORITY_ORDER: Record<string, number> = {
    urgent: 0,
    medium: 1,
    low: 2,
    overdue: 3,
};

/** Преобразует дату в локальную строку YYYY-MM-DD */
const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TaskCalendar: React.FC<TaskCalendarProps> = ({ tasks, onTaskClick }) => {
    const { user } = useAppSelector((state) => state.auth);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [dayTasksDialogOpen, setDayTasksDialogOpen] = useState(false);
    const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]>([]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    // Карта задач по дате дедлайна
    const tasksByDate = useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach((task) => {
            if (!task.deadline) return;
            const dateKey = toLocalDateString(new Date(task.deadline));
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)!.push(task);
        });
        return map;
    }, [tasks]);

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const getDateKey = (day: number) =>
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const handleDayClick = (day: number) => {
        const dateStr = getDateKey(day);
        const dayTasks = tasksByDate.get(dateStr) || [];
        setSelectedDate(dateStr);
        if (dayTasks.length > 0) {
            setSelectedDayTasks(dayTasks);
            setDayTasksDialogOpen(true);
        }
    };

    const handleTaskSelect = (task: Task) => {
        setDayTasksDialogOpen(false);
        onTaskClick(task);
    };

    // Цвет дня определяется наиболее приоритетной задачей этого дня
    const getDayColor = (dayTasks: Task[]): string => {
        if (dayTasks.length === 0) return 'transparent';
        // Невыполненные важнее: день красится по ним, и только если всё выполнено — зелёным
        const pending = dayTasks.filter((t) => !isTaskDoneFor(t, user));
        if (pending.length === 0) return getTaskColor(dayTasks[0], user);
        const top = [...pending].sort(
            (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
        )[0];
        return getPriorityColor(top.priority);
    };

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) calendarDays.push(null);
    for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

    const today = new Date();
    const isToday = (day: number) =>
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

    return (
        <>
            <Paper sx={{ p: 2 }}>
                {/* Навигация */}
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
                        const dayTasks = day ? tasksByDate.get(dateKey) || [] : [];
                        const hasTasks = dayTasks.length > 0;
                        const isSelected = dateKey === selectedDate;
                        const dayColor = getDayColor(dayTasks);

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
                                        ? 'action.selected'
                                        : day && isToday(day)
                                            ? 'action.hover'
                                            : 'transparent',
                                    border: hasTasks ? '2px solid' : '1px solid transparent',
                                    borderColor: hasTasks ? dayColor : 'transparent',
                                    '&:hover': day ? { bgcolor: 'action.hover' } : {},
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                }}
                            >
                                {day && (
                                    <>
                                        <Typography
                                            variant="body2"
                                            fontWeight={isToday(day) ? 'bold' : 'normal'}
                                        >
                                            {day}
                                        </Typography>
                                        {hasTasks && (
                                            <Box
                                                sx={{
                                                    mt: 0.3,
                                                    minWidth: 18,
                                                    height: 18,
                                                    px: 0.5,
                                                    borderRadius: '9px',
                                                    bgcolor: dayColor,
                                                    color: 'white',
                                                    fontSize: 11,
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {dayTasks.length}
                                            </Box>
                                        )}
                                    </>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                {/* Легенда */}
                <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {(['urgent', 'medium', 'low', 'overdue'] as const).map((p) => (
                        <Box key={p} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box
                                sx={{
                                    width: 12,
                                    height: 12,
                                    border: '2px solid',
                                    borderColor: getPriorityColor(p),
                                    borderRadius: 0.5,
                                }}
                            />
                            <Typography variant="caption">{getPriorityLabel(p)}</Typography>
                        </Box>
                    ))}
                </Box>
            </Paper>

            {/* Диалог со списком задач на день */}
            <Dialog
                open={dayTasksDialogOpen}
                onClose={() => setDayTasksDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Задачи на {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                    })}
                </DialogTitle>
                <DialogContent>
                    <List>
                        {selectedDayTasks.map((task) => {
                            const color = getTaskColor(task, user);
                            return (
                                <ListItemButton
                                    key={task.id}
                                    onClick={() => handleTaskSelect(task)}
                                    sx={{
                                        borderRadius: 1,
                                        mb: 1,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderLeft: '4px solid',
                                        borderLeftColor: color,
                                    }}
                                >
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {task.title}
                                                <Chip
                                                    label={getPriorityLabel(task.priority)}
                                                    size="small"
                                                    sx={{ height: 20, fontSize: 10, bgcolor: color, color: 'white' }}
                                                />
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ mt: 0.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <AccessTime sx={{ fontSize: 14 }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(task.deadline).toLocaleTimeString('ru-RU', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Person sx={{ fontSize: 14 }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {task.creatorName}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                    {task.assigneeCategories?.slice(0, 3).map((cat) => (
                                                        <Chip
                                                            key={cat}
                                                            label={cat}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ height: 20, fontSize: 11 }}
                                                        />
                                                    ))}
                                                    {task.assigneeCategories && task.assigneeCategories.length > 3 && (
                                                        <Chip
                                                            label={`+${task.assigneeCategories.length - 3}`}
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

export default TaskCalendar;
