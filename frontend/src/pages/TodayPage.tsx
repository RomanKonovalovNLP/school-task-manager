import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Alert,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Snackbar,
    Divider,
    InputAdornment,
    Paper,
    LinearProgress,
    useTheme,
    alpha,
} from '@mui/material';
import {
    Add,
    Bolt,
    RemoveCircleOutline,
    Lock,
    Search,
    AccessTime,
    CheckCircle,
    Person,
    Folder,
    Home,
    Event as EventIcon,
    SwapHoriz,
    RadioButtonUnchecked,
    WarningAmber,
    Place,
    TouchApp,
    PersonPin,
} from '@mui/icons-material';
import MainLayout from '../components/layout/MainLayout';
import TaskModal from '../components/tasks/TaskModal';
import EventDetailModal from '../components/events/EventDetailModal';
import { tasksService, FocusTask, TodayFocus } from '../services/tasks.service';
import { eventsService, Event } from '../services/events.service';
import { scheduleService } from '../services/schedule.service';
import { Task } from '../types';
import { getPriorityColor, getPriorityLabel, formatDeadline, COMPLETED_COLOR } from '../utils/taskHelpers';
import { useCelebration } from '../components/celebration/CelebrationProvider';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { setSelectedTask } from '../store/slices/tasksSlice';
import { useNavigate } from 'react-router-dom';

// Сетка карточек — как на вкладке «Задачи»: тикеты в несколько колонок
const GRID_SX = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 2,
    alignItems: 'stretch',
} as const;

const localDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const greetingFor = (hour: number) => {
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
};

const TodayPage: React.FC = () => {
    const celebrate = useCelebration();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const theme = useTheme();
    const { user } = useAppSelector((state) => state.auth);

    const [focus, setFocus] = useState<TodayFocus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [snack, setSnack] = useState<string | null>(null);

    // Контекст дня в боковой колонке
    const [todayEvents, setTodayEvents] = useState<Event[]>([]);
    const [subsCount, setSubsCount] = useState(0);

    // Просмотр мероприятия
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);

    // Диалог добавления задач в план
    const [addOpen, setAddOpen] = useState(false);
    const [candidates, setCandidates] = useState<Task[]>([]);
    const [candidatesLoading, setCandidatesLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState<number[]>([]);

    // Подпись плана (дата + число задач), за который уже поздравили в этой сессии
    const celebratedRef = useRef<string | null>(null);

    /**
     * Поздравление за весь день.
     * Вызывается прямо из загрузки данных (а не из useEffect по изменению стейта),
     * чтобы срабатывать детерминированно: и когда пользователь закрыл последнюю
     * задачу здесь, и когда закрыл её в модалке, и когда открыл страницу уже на 100%.
     */
    const celebrateDay = useCallback(
        (data: TodayFocus, force = false) => {
            if (!data.allDone || data.total === 0) return;

            const signature = `${data.date}:${data.total}`;
            if (!force) {
                if (celebratedRef.current === signature) return;
                celebratedRef.current = signature;
                try {
                    const key = `plantakt_day_done_${signature}`;
                    if (localStorage.getItem(key)) return;
                    localStorage.setItem(key, '1');
                } catch {
                    /* localStorage недоступен — поздравляем всё равно */
                }
            }

            celebrate({
                variant: 'complete',
                message: 'План на сегодня выполнен!',
                subtitle:
                    data.total === 1
                        ? 'Задача закрыта. Отличная работа!'
                        : `Все ${data.total} задач(и) закрыты. Отличная работа!`,
            });
        },
        [celebrate],
    );

    const load = useCallback(async () => {
        try {
            const data = await tasksService.getTodayFocus();
            setFocus(data);
            setError(null);
            celebrateDay(data);
        } catch (e) {
            setError('Не удалось загрузить план на сегодня');
        } finally {
            setLoading(false);
        }
    }, [celebrateDay]);

    const loadDayContext = useCallback(async () => {
        const key = localDateKey(new Date());
        try {
            setTodayEvents(await eventsService.getByDate(key));
        } catch {
            setTodayEvents([]);
        }
        try {
            const res: any = await scheduleService.getSubstitutions(key);
            setSubsCount((res?.substitutions || []).length);
        } catch {
            setSubsCount(0);
        }
    }, []);

    useEffect(() => {
        load();
        loadDayContext();
    }, [load, loadDayContext]);

    const handleToggle = async (task: FocusTask) => {
        // Оптимистично обновляем, чтобы галочка ставилась мгновенно
        setFocus((prev) =>
            prev
                ? (() => {
                      const tasks = prev.tasks.map((t) =>
                          t.id === task.id ? { ...t, isCompletedByUser: !t.isCompletedByUser } : t,
                      );
                      const completed = tasks.filter((t) => t.isCompletedByUser).length;
                      return { ...prev, tasks, completed, allDone: tasks.length > 0 && completed === tasks.length };
                  })()
                : prev,
        );

        try {
            await tasksService.toggleCompletion(task.id);
            await load();
        } catch {
            setSnack('Не удалось изменить статус задачи');
            load();
        }
    };

    const handleRemove = async (task: FocusTask) => {
        try {
            const res = await tasksService.removeFromTodayFocus(task.id);
            if (!res.success) {
                // Срочную задачу убрать нельзя — объясняем понятным языком
                setSnack(res.message || 'Эту задачу нельзя убрать из плана на сегодня');
                return;
            }
            setSnack('Задача убрана из плана на сегодня');
            load();
        } catch {
            setSnack('Не удалось убрать задачу из плана');
        }
    };

    /** Открыть подробности мероприятия (подгружаем полные данные: файлы, задачи, программа) */
    const openEvent = async (ev: Event) => {
        setSelectedEvent(ev);
        setEventModalOpen(true);
        try {
            const full = await eventsService.getById(ev.id);
            setSelectedEvent(full);
        } catch {
            setSnack('Не удалось загрузить мероприятие полностью');
        }
    };

    const openAddDialog = async () => {
        setAddOpen(true);
        setPicked([]);
        setSearch('');
        setCandidatesLoading(true);
        try {
            const list = await tasksService.getTodayFocusCandidates();
            setCandidates(list);
        } catch {
            setCandidates([]);
            setSnack('Не удалось загрузить список задач');
        } finally {
            setCandidatesLoading(false);
        }
    };

    const handleAddPicked = async () => {
        try {
            await Promise.all(picked.map((id) => tasksService.addToTodayFocus(id)));
            setAddOpen(false);
            setSnack(
                picked.length === 1
                    ? 'Задача добавлена в план на сегодня'
                    : `Добавлено задач: ${picked.length}`,
            );
            load();
        } catch {
            setSnack('Не удалось добавить задачи в план');
        }
    };

    const filteredCandidates = candidates.filter((t) =>
        t.title.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const autoTasks = focus?.tasks.filter((t) => t.isAuto) || [];
    const myTasks = focus?.tasks.filter((t) => !t.isAuto) || [];
    const overdueCount = focus?.tasks.filter((t) => new Date(t.deadline).getTime() < Date.now()).length || 0;
    const left = focus ? focus.total - focus.completed : 0;
    const percent = focus && focus.total > 0 ? Math.round((focus.completed / focus.total) * 100) : 0;

    const now = new Date();
    const today = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const nameParts = (user?.fullName || '').trim().split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0] || '';

    const heroSubtitle = !focus
        ? ''
        : focus.total === 0
          ? 'На сегодня ничего не запланировано'
          : focus.allDone
            ? 'План на сегодня выполнен полностью'
            : `Осталось задач: ${left} из ${focus.total}`;

    // Кольцо прогресса (по клику на 100% можно пересмотреть поздравление)
    const ProgressRing = (
        <Box
            onClick={() => focus && focus.allDone && celebrateDay(focus, true)}
            title={focus?.allDone ? 'Показать поздравление ещё раз' : undefined}
            sx={{ position: 'relative', display: 'inline-flex', cursor: focus?.allDone ? 'pointer' : 'default' }}
        >
            <CircularProgress
                variant="determinate"
                value={100}
                size={92}
                thickness={4}
                sx={{ color: alpha('#fff', 0.25) }}
            />
            <CircularProgress
                variant="determinate"
                value={percent}
                size={92}
                thickness={4}
                sx={{ color: '#fff', position: 'absolute', left: 0, [`& .MuiCircularProgress-circle`]: { strokeLinecap: 'round' } }}
            />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                    {percent}%
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                    {focus?.completed || 0}/{focus?.total || 0}
                </Typography>
            </Box>
        </Box>
    );

    const renderTask = (task: FocusTask) => (
        <Card
            key={task.id}
            variant="outlined"
            onClick={() => dispatch(setSelectedTask(task))}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: `4px solid ${task.isCompletedByUser ? COMPLETED_COLOR : getPriorityColor(task.priority)}`,
                opacity: task.isCompletedByUser ? 0.6 : 1,
                transition: 'opacity .2s, box-shadow .2s, transform .2s',
                cursor: 'pointer',
                '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
            }}
        >
            <CardContent
                sx={{ flexGrow: 1, display: 'flex', alignItems: 'flex-start', gap: 1, '&:last-child': { pb: 2 } }}
            >
                <Checkbox
                    checked={task.isCompletedByUser}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleToggle(task)}
                    sx={{ mt: -0.5 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 500,
                            textDecoration: task.isCompletedByUser ? 'line-through' : 'none',
                            wordBreak: 'break-word',
                        }}
                    >
                        {task.title}
                    </Typography>

                    {task.description && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                mt: 0.5,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                        >
                            {task.description}
                        </Typography>
                    )}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1, alignItems: 'center' }}>
                        <Chip
                            size="small"
                            icon={<AccessTime sx={{ fontSize: '0.9rem' }} />}
                            label={formatDeadline(task.deadline)}
                            sx={{ bgcolor: task.isCompletedByUser ? COMPLETED_COLOR : getPriorityColor(task.priority), color: '#fff' }}
                        />
                        <Chip size="small" variant="outlined" label={getPriorityLabel(task.priority)} />
                        {task.isAuto && (
                            <Chip
                                size="small"
                                color="error"
                                variant="outlined"
                                icon={<Bolt sx={{ fontSize: '0.9rem' }} />}
                                label="Срок сегодня"
                            />
                        )}
                        {/* Личная задача — как и на вкладке «Задачи» */}
                        {task.isPersonal && (
                            <Chip
                                size="small"
                                color="info"
                                variant="outlined"
                                icon={<Lock sx={{ fontSize: '0.9rem' }} />}
                                label="Личная"
                            />
                        )}
                        {(task.assigneeCategories || []).slice(0, 2).map((c) => (
                            <Chip
                                key={c}
                                size="small"
                                variant="outlined"
                                icon={<Folder sx={{ fontSize: '0.9rem' }} />}
                                label={c}
                            />
                        ))}
                        {/* Адресована лично текущему пользователю */}
                        {!task.isPersonal && (task.assigneeUsers || []).includes(user?.fullName || '') && (
                            <Chip
                                size="small"
                                color="secondary"
                                icon={<PersonPin sx={{ fontSize: '0.9rem' }} />}
                                label="Персонально вам"
                            />
                        )}
                        {/* Остальные персональные адресаты (видно создателю и админу) */}
                        {(task.assigneeUsers || [])
                            .filter((u) => u !== user?.fullName)
                            .slice(0, 2)
                            .map((u) => (
                                <Chip
                                    key={`u-${u}`}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    icon={<Person sx={{ fontSize: '0.9rem' }} />}
                                    label={u}
                                />
                            ))}
                        {(task.attachmentsCount ?? 0) > 0 && (
                            <Chip size="small" variant="outlined" label={`Файлов: ${task.attachmentsCount}`} />
                        )}
                    </Box>
                </Box>

                <Tooltip
                    title={
                        task.isAuto
                            ? 'Срок сегодня — задача остаётся в плане. Нажмите, чтобы узнать почему'
                            : 'Убрать из плана на сегодня'
                    }
                >
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(task);
                        }}
                    >
                        {task.isAuto ? <Lock fontSize="small" /> : <RemoveCircleOutline fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </CardContent>
        </Card>
    );

    const summaryRow = (icon: React.ReactNode, label: string, value: number, color?: string) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
            <Box sx={{ display: 'flex', color: color || 'text.secondary' }}>{icon}</Box>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {label}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {value}
            </Typography>
        </Box>
    );

    return (
        <MainLayout>
            <Box sx={{ width: '100%' }}>
                {/* ГЕРОЙ-ШАПКА */}
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2, md: 3 },
                        mb: 3,
                        borderRadius: 3,
                        color: '#fff',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%, ${theme.palette.secondary.dark || theme.palette.primary.dark} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 2, md: 3 },
                        flexWrap: 'wrap',
                    }}
                >
                    <Tooltip title="На главную">
                        <IconButton onClick={() => navigate('/dashboard')} sx={{ color: '#fff' }}>
                            <Home />
                        </IconButton>
                    </Tooltip>

                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Bolt /> {firstName ? `${greetingFor(now.getHours())}, ${firstName}` : 'Сегодня'}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9, textTransform: 'capitalize' }}>
                            {today}
                        </Typography>
                        {heroSubtitle && (
                            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                                {heroSubtitle}
                            </Typography>
                        )}
                    </Box>

                    <Box
                        sx={{
                            ml: { md: 'auto' },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexWrap: 'wrap',
                        }}
                    >
                        {focus && focus.total > 0 && ProgressRing}
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={openAddDialog}
                            sx={{
                                bgcolor: '#fff',
                                color: 'primary.main',
                                fontWeight: 600,
                                '&:hover': { bgcolor: alpha('#fff', 0.88) },
                            }}
                        >
                            Добавить задачу
                        </Button>
                    </Box>
                </Paper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 3,
                            alignItems: 'flex-start',
                            flexDirection: { xs: 'column', lg: 'row' },
                        }}
                    >
                        {/* ОСНОВНАЯ КОЛОНКА */}
                        <Box sx={{ flexGrow: 1, width: '100%', minWidth: 0 }}>
                            {focus && focus.total > 0 && (
                                <LinearProgress
                                    variant="determinate"
                                    value={percent}
                                    color={focus.allDone ? 'success' : 'primary'}
                                    sx={{ height: 8, borderRadius: 4, mb: 3 }}
                                />
                            )}

                            {/* Пустой план */}
                            {focus && focus.total === 0 && (
                                <Card sx={{ textAlign: 'center', py: 6 }}>
                                    <CardContent>
                                        <Typography variant="h1" sx={{ fontSize: 56, lineHeight: 1, mb: 1 }}>
                                            🌤️
                                        </Typography>
                                        <Typography variant="h6" sx={{ mb: 1 }}>
                                            На сегодня ничего не горит
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mb: 2, maxWidth: 460, mx: 'auto' }}
                                        >
                                            Задачи со сроком на сегодня появятся здесь автоматически. А пока вы
                                            можете сами выбрать, чем заняться — в том числе разобрать просроченное.
                                        </Typography>
                                        <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>
                                            Спланировать день
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Срочное */}
                            {autoTasks.length > 0 && (
                                <Box sx={{ mb: 4 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Bolt color="error" fontSize="small" />
                                        <Typography variant="h6">Горит сегодня</Typography>
                                        <Chip size="small" color="error" label={autoTasks.length} />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                        Эти задачи добавлены автоматически: их срок истекает сегодня.
                                    </Typography>
                                    <Box sx={GRID_SX}>{autoTasks.map(renderTask)}</Box>
                                </Box>
                            )}

                            {/* Мой план */}
                            {myTasks.length > 0 && (
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <TouchApp color="primary" fontSize="small" />
                                        <Typography variant="h6">Мой план на день</Typography>
                                        <Chip size="small" label={myTasks.length} />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                                        Задачи, которые вы выбрали сами. Их можно убрать в любой момент.
                                    </Typography>
                                    <Box sx={GRID_SX}>{myTasks.map(renderTask)}</Box>
                                </Box>
                            )}
                        </Box>

                        {/* БОКОВАЯ КОЛОНКА — контекст дня */}
                        <Box
                            sx={{
                                width: { xs: '100%', lg: 330 },
                                flexShrink: 0,
                                position: { lg: 'sticky' },
                                top: 88,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                            }}
                        >
                            {/* Сводка */}
                            <Card>
                                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        Сводка дня
                                    </Typography>
                                    {summaryRow(<CheckCircle fontSize="small" />, 'Выполнено', focus?.completed || 0, theme.palette.success.main)}
                                    {summaryRow(<RadioButtonUnchecked fontSize="small" />, 'Осталось', left)}
                                    {summaryRow(<Bolt fontSize="small" />, 'Со сроком сегодня', autoTasks.length, theme.palette.error.main)}
                                    {overdueCount > 0 &&
                                        summaryRow(
                                            <WarningAmber fontSize="small" />,
                                            'Просроченных в плане',
                                            overdueCount,
                                            theme.palette.warning.main,
                                        )}
                                </CardContent>
                            </Card>

                            {/* Мероприятия сегодня */}
                            <Card>
                                <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <EventIcon fontSize="small" color="primary" />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                                            Мероприятия сегодня
                                        </Typography>
                                        {todayEvents.length > 0 && <Chip size="small" label={todayEvents.length} />}
                                    </Box>

                                    {todayEvents.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Сегодня мероприятий нет
                                        </Typography>
                                    ) : (
                                        <List dense disablePadding>
                                            {todayEvents.slice(0, 4).map((ev) => (
                                                <ListItem key={ev.id} disableGutters disablePadding>
                                                    <ListItemButton
                                                        onClick={() => openEvent(ev)}
                                                        sx={{ borderRadius: 1, alignItems: 'flex-start' }}
                                                    >
                                                        <ListItemText
                                                            primary={ev.title}
                                                            secondary={
                                                                <>
                                                                    {ev.allDay
                                                                        ? 'Весь день'
                                                                        : new Date(ev.startDate).toLocaleTimeString(
                                                                              'ru-RU',
                                                                              { hour: '2-digit', minute: '2-digit' },
                                                                          )}
                                                                    {ev.location ? ` · ${ev.location}` : ''}
                                                                </>
                                                            }
                                                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                                                            secondaryTypographyProps={{ variant: 'caption' }}
                                                        />
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}

                                    <Button size="small" onClick={() => navigate('/events')} sx={{ mt: 0.5 }}>
                                        Все мероприятия
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Замены на сегодня */}
                            {subsCount > 0 && (
                                <Card sx={{ borderLeft: `4px solid ${theme.palette.secondary.main}` }}>
                                    <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <SwapHoriz fontSize="small" color="secondary" />
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                Замены на сегодня
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            В расписании на сегодня изменений: {subsCount}
                                        </Typography>
                                        <Button size="small" onClick={() => navigate('/schedule')} sx={{ mt: 0.5 }}>
                                            Открыть расписание
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Как это работает */}
                            <Card variant="outlined" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        Как работает режим «Сегодня»
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.75 }}>
                                        • Задачи со сроком на сегодня попадают сюда сами и остаются до конца дня.
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.75 }}>
                                        • Любую другую задачу — даже просроченную — можно добавить вручную и так же
                                        убрать.
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                        • Закройте весь план — и день завершится маленьким праздником 🎉
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Диалог добавления задач */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Добавить задачи в план на сегодня</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Поиск по названию…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ mb: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        Можно взять любую задачу: с будущим сроком или просроченную. Убрать её из плана вы
                        сможете в любой момент.
                    </Typography>
                    <Divider sx={{ my: 1 }} />

                    {candidatesLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : filteredCandidates.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                            {candidates.length === 0
                                ? 'Все доступные задачи уже в плане на сегодня'
                                : 'Ничего не найдено'}
                        </Typography>
                    ) : (
                        <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
                            {filteredCandidates.map((t) => {
                                const checked = picked.includes(t.id);
                                const isOverdue = new Date(t.deadline).getTime() < Date.now();
                                return (
                                    <ListItem key={t.id} disablePadding>
                                        <ListItemButton
                                            onClick={() =>
                                                setPicked((prev) =>
                                                    checked ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                                                )
                                            }
                                        >
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={t.title}
                                                secondary={`${
                                                    isOverdue ? 'Просрочено — срок был' : 'Срок:'
                                                } ${new Date(t.deadline).toLocaleString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}`}
                                                secondaryTypographyProps={{
                                                    color: isOverdue ? 'error.main' : 'text.secondary',
                                                }}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleAddPicked} disabled={picked.length === 0}>
                        Добавить{picked.length > 0 ? ` (${picked.length})` : ''}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Детали задачи: описание, вложения, отметка о выполнении */}
            <TaskModal onRefresh={load} />

            {/* Детали мероприятия: описание, файлы, задачи, программа */}
            <EventDetailModal
                open={eventModalOpen}
                event={selectedEvent}
                onClose={() => {
                    setEventModalOpen(false);
                    setSelectedEvent(null);
                }}
                onRefresh={loadDayContext}
                onEdit={() => {
                    // Редактирование живёт на странице мероприятий
                    setEventModalOpen(false);
                    navigate('/events');
                }}
            />

            <Snackbar
                open={!!snack}
                autoHideDuration={5000}
                onClose={() => setSnack(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnack(null)} severity="info" variant="filled" sx={{ width: '100%' }}>
                    {snack}
                </Alert>
            </Snackbar>
        </MainLayout>
    );
};

export default TodayPage;
