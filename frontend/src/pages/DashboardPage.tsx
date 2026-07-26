import React, { useEffect, useState } from 'react';
import {
    Box,
    Fab,
    Typography,
    Alert,
    Paper,
    useMediaQuery,
    useTheme,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import {
    Add,
    ViewList,
    CalendarMonth,
    People,
    PersonOutline,
    SwapHoriz,
    Bolt,
    CheckCircle,
    RadioButtonUnchecked,
    WarningAmber,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import TaskList from '../components/tasks/TaskList';
import TaskCalendar from '../components/tasks/TaskCalendar';
import TaskCard from '../components/tasks/TaskCard';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskModal from '../components/tasks/TaskModal';
import TaskFilters from '../components/tasks/TaskFilters';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { setTasks, setLoading, setSelectedTask, setFilters } from '../store/slices/tasksSlice';
import { Task } from '../types';
import { setCategories } from '../store/slices/filtersSlice';
import { tasksService } from '../services/tasks.service';
import { scheduleService } from '../services/schedule.service';
import { filtersService } from '../services/filters.service';
import { COMPLETED_COLOR } from '../utils/taskHelpers';

const DashboardPage: React.FC = () => {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { filters, tasks } = useAppSelector((state) => state.tasks);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Фильтры по типу задач (множественный выбор)
    const [taskTypeFilter, setTaskTypeFilter] = useState<string[]>(['shared', 'personal']);

    // Замены на сегодня (из активной версии расписания)
    const [todaySubs, setTodaySubs] = useState<any[]>([]);
    const [todayOrig, setTodayOrig] = useState<Map<number, any>>(new Map());

    const showShared = taskTypeFilter.includes('shared');
    const showPersonal = taskTypeFilter.includes('personal');

    // Срочные и просроченные задачи для панели рядом с календарём
    const urgentTasks = [...tasks]
        .filter((t) => t.priority === 'urgent' || t.priority === 'overdue')
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    useEffect(() => {
        if (isMobile) {
            setViewMode('list');
        }
    }, [isMobile]);

    useEffect(() => {
        loadTasks();
        loadCategories();
        loadTodaySubs();
    }, []);

    const loadTodaySubs = async () => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const res: any = await scheduleService.getSubstitutions(today);
            setTodaySubs(res?.substitutions || []);
            const m = new Map<number, any>();
            (res?.originalLessons || []).forEach((l: any) => m.set(l.id, l));
            setTodayOrig(m);
        } catch { setTodaySubs([]); }
    };

    useEffect(() => {
        loadTasks();
    }, [filters, showShared, showPersonal]);

    const loadTasks = async () => {
        dispatch(setLoading(true));
        try {
            const tasks = await tasksService.getAll({
                category: filters.category.length ? filters.category : undefined,
                priority: filters.priority.length ? filters.priority : undefined,
                creatorName: filters.creatorName || undefined,
                showShared,
                showPersonal,
            });
            dispatch(setTasks(tasks));
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const categories = await filtersService.getAll();
            dispatch(setCategories(categories));
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const handleViewModeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newMode: 'list' | 'calendar' | null,
    ) => {
        if (newMode !== null) {
            setViewMode(newMode);
        }
    };

    const handleCalendarTaskClick = (task: Task) => {
        dispatch(setSelectedTask(task));
    };

    // Переключатели «показывать выполненные / просроченные».
    // В сторе хранятся флаги скрытия, поэтому здесь инвертируем.
    const visibilityFilter = [
        ...(filters.hideCompleted ? [] : ['completed']),
        ...(filters.hideOverdue ? [] : ['overdue']),
    ];

    const handleVisibilityChange = (_e: React.MouseEvent<HTMLElement>, newValue: string[]) => {
        dispatch(
            setFilters({
                hideCompleted: !newValue.includes('completed'),
                hideOverdue: !newValue.includes('overdue'),
            }),
        );
    };

    const handleTaskTypeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newFilter: string[],
    ) => {
        // «Сегодня» — не фильтр, а переход в режим фокуса
        if (newFilter.includes('today')) {
            navigate('/today');
            return;
        }
        // Не позволяем снять оба фильтра
        if (newFilter.length > 0) {
            setTaskTypeFilter(newFilter);
        }
    };

    return (
        <MainLayout>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
                    <TaskFilters onRefresh={loadTasks} />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                        {/* Фильтр Общие / Личные — ToggleButtonGroup как у Список/Рабочее поле */}
                        <ToggleButtonGroup
                            value={taskTypeFilter}
                            onChange={handleTaskTypeChange}
                            size="small"
                        >
                            <ToggleButton value="shared" sx={{ whiteSpace: 'nowrap' }}>
                                <People sx={{ mr: 0.5, fontSize: 18 }} />
                                Общие
                            </ToggleButton>
                            <ToggleButton value="personal" sx={{ whiteSpace: 'nowrap' }}>
                                <PersonOutline sx={{ mr: 0.5, fontSize: 18 }} />
                                Личные
                            </ToggleButton>
                            {/* Не фильтр, а переход в режим фокуса «Сегодня» */}
                            <ToggleButton value="today" sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}>
                                <Bolt sx={{ mr: 0.5, fontSize: 18 }} />
                                Сегодня
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {/* Что показывать: выключенная кнопка = задачи скрыты */}
                        <ToggleButtonGroup
                            value={visibilityFilter}
                            onChange={handleVisibilityChange}
                            size="small"
                        >
                            <ToggleButton
                                value="completed"
                                sx={{
                                    // Ширина фиксирована, иначе смена иконки сдвигает соседние фильтры
                                    minWidth: 168,
                                    whiteSpace: 'nowrap',
                                    '&.Mui-selected': { color: COMPLETED_COLOR, borderColor: COMPLETED_COLOR },
                                }}
                            >
                                <Tooltip title="Показывать выполненные задачи">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {filters.hideCompleted ? (
                                            <RadioButtonUnchecked sx={{ mr: 0.5, fontSize: 18 }} />
                                        ) : (
                                            <CheckCircle sx={{ mr: 0.5, fontSize: 18 }} />
                                        )}
                                        Выполненные
                                    </Box>
                                </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="overdue" sx={{ minWidth: 176, whiteSpace: 'nowrap' }}>
                                <Tooltip title="Показывать просроченные задачи">
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {filters.hideOverdue ? (
                                            <RadioButtonUnchecked sx={{ mr: 0.5, fontSize: 18 }} />
                                        ) : (
                                            <WarningAmber sx={{ mr: 0.5, fontSize: 18 }} />
                                        )}
                                        Просроченные
                                    </Box>
                                </Tooltip>
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {/* Список / Календарь */}
                        {!isMobile && (
                            <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                                <ToggleButton value="list">
                                    <ViewList sx={{ mr: 0.5, fontSize: 18 }} />
                                    Список
                                </ToggleButton>
                                <ToggleButton value="calendar">
                                    <CalendarMonth sx={{ mr: 0.5, fontSize: 18 }} />
                                    Календарь
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}
                    </Box>
                </Box>

                {todaySubs.length > 0 && (
                    <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderColor: 'secondary.main', bgcolor: 'rgba(142,36,170,0.04)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <SwapHoriz color="secondary" fontSize="small" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Замены на сегодня ({todaySubs.length})</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {todaySubs.slice(0, 10).map((sub: any) => {
                                const orig = todayOrig.get(sub.lessonId);
                                const cls = orig?.workload?.schoolClass?.name || '';
                                const wasSubj = orig?.workload?.subject?.shortName || orig?.workload?.subject?.name || '';
                                const to = sub.isCancelled
                                    ? 'окно'
                                    : ([sub.newSubject?.name, sub.newTeacher?.shortName, sub.newRoom?.name].filter(Boolean).join(', ') || 'изменение');
                                return (
                                    <Typography key={sub.id} variant="caption" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 0.75, py: 0.25 }}>
                                        {[cls, orig ? `${orig.lessonNumber} ур.` : '', wasSubj].filter(Boolean).join(' · ')} → {to}
                                    </Typography>
                                );
                            })}
                            {todaySubs.length > 10 && <Typography variant="caption" color="text.secondary">+{todaySubs.length - 10} ещё</Typography>}
                        </Box>
                    </Paper>
                )}

                <Box sx={{ flexGrow: 1, overflow: 'auto', mt: 2 }}>
                    {viewMode === 'list' ? (
                        <TaskList onRefresh={loadTasks} />
                    ) : (
                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {/* Календарь слева */}
                            <Box sx={{ flex: '1 1 320px', minWidth: 300, maxWidth: 480 }}>
                                <TaskCalendar tasks={tasks} onTaskClick={handleCalendarTaskClick} />
                            </Box>

                            {/* Срочные задачи справа */}
                            <Box sx={{ flex: '2 1 360px', minWidth: 300 }}>
                                <Typography variant="h6" gutterBottom>
                                    Срочные задачи
                                </Typography>
                                {urgentTasks.length === 0 ? (
                                    <Alert severity="success">Срочных задач нет</Alert>
                                ) : (
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                                        {urgentTasks.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                onClick={() => handleCalendarTaskClick(task)}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    )}
                </Box>

                <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 16, right: 16 }} onClick={() => setCreateModalOpen(true)}>
                    <Add />
                </Fab>

                <CreateTaskModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={loadTasks} />
                <TaskModal onRefresh={loadTasks} />
            </Box>
        </MainLayout>
    );
};

export default DashboardPage;
