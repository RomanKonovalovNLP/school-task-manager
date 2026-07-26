import React, { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    MoreVert,
    ContentCopy,
    Visibility,
    Publish,
    CheckCircle,
    Schedule,
    Settings,
    Home,
    SwapHoriz,
    Unpublished,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { scheduleService } from '../services/schedule.service';
import {
    ScheduleVersion,
    ScheduleVersionType,
    WeekType,
    ScheduleStatus,
    WORKING_DAYS_5,
    WORKING_DAYS_6,
} from '../types/schedule';
import { INSTITUTION_TYPES, InstitutionType, getTerms } from '../utils/institutionTypes';

const ScheduleDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<'all' | ScheduleVersionType>('all');

    const getErrorMessage = (err: any, fallback: string): string => {
        const msg = err?.response?.data?.message ?? err?.message;
        if (Array.isArray(msg)) return msg.join(', ');
        if (typeof msg === 'string') return msg;
        if (typeof msg === 'object' && msg !== null) return JSON.stringify(msg);
        return fallback;
    };
    
    // Меню действий
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedVersion, setSelectedVersion] = useState<ScheduleVersion | null>(null);
    
    // Диалог создания
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newVersion, setNewVersion] = useState({
        name: '',
        type: ScheduleVersionType.TEMPLATE,
        weekType: WeekType.SINGLE,
        workingDays: WORKING_DAYS_5 as number,
        institutionType: 'school' as InstitutionType,
        maxLessonsPerDay: 7,
    });

    // Загрузка данных
    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await scheduleService.getVersions();
            setVersions(Array.isArray(data) ? data : data.versions || []);
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка загрузки расписаний'));
        } finally {
            setLoading(false);
        }
    };

    // Открытие меню
    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, version: ScheduleVersion) => {
        event.stopPropagation();
        setMenuAnchor(event.currentTarget);
        setSelectedVersion(version);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
        setSelectedVersion(null);
    };

    // Создание версии
    const handleCreate = async () => {
        try {
            const response = await scheduleService.createVersion(newVersion);
            const created = (response as any).version || response;
            setVersions((prev) => [...prev, created]);
            setCreateDialogOpen(false);
            setNewVersion({
                name: '',
                type: ScheduleVersionType.TEMPLATE,
                weekType: WeekType.SINGLE,
                workingDays: WORKING_DAYS_5,
                institutionType: 'school',
                maxLessonsPerDay: 7,
            });
            navigate(`/schedule/editor/${created.id}`);
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка создания расписания'));
        }
    };

    // Копирование версии
    const handleCopy = async () => {
        if (!selectedVersion) return;
        try {
            const response = await scheduleService.copyVersion(
                selectedVersion.id,
                `${selectedVersion.name} (копия)`
            );
            const copied = (response as any).version || response;
            setVersions((prev) => [...prev, copied]);
            handleMenuClose();
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка копирования'));
        }
    };

    // Создать замены на основе шаблона
    const handleCreateSubstitution = async () => {
        if (!selectedVersion) return;
        try {
            const response = await scheduleService.copyVersion(
                selectedVersion.id,
                selectedVersion.name,
                ScheduleVersionType.SUBSTITUTION,
            );
            const created = (response as any).version || response;
            setVersions((prev) => [...prev, created]);
            handleMenuClose();
            navigate(`/schedule/editor/${created.id}`);
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка создания замен'));
        }
    };

    // Удаление версии
    const handleDelete = async () => {
        if (!selectedVersion) return;
        if (!window.confirm(`Удалить расписание "${selectedVersion.name}"?`)) return;
        
        try {
            await scheduleService.deleteVersion(selectedVersion.id);
            setVersions((prev) => prev.filter((v) => v.id !== selectedVersion.id));
            handleMenuClose();
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка удаления'));
        }
    };

    // Активация версии
    const handleActivate = async () => {
        if (!selectedVersion) return;
        try {
            const updated = await scheduleService.activateVersion(selectedVersion.id);
            setVersions((prev) =>
                prev.map((v) => ({
                    ...v,
                    isActive: v.id === updated.id,
                }))
            );
            handleMenuClose();
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка активации'));
        }
    };

    // Публикация версии
    const handlePublish = async () => {
        if (!selectedVersion) return;
        try {
            const updated = await scheduleService.publishVersion(selectedVersion.id);
            setVersions((prev) =>
                prev.map((v) => (v.id === updated.id ? updated : v))
            );
            handleMenuClose();
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка публикации'));
        }
    };

    // Снятие с публикации
    const handleUnpublish = async () => {
        if (!selectedVersion) return;
        try {
            const updated = await scheduleService.unpublishVersion(selectedVersion.id);
            setVersions((prev) =>
                prev.map((v) => (v.id === updated.id ? updated : v))
            );
            handleMenuClose();
        } catch (err: any) {
            setError(getErrorMessage(err, 'Ошибка снятия с публикации'));
        }
    };

    // Форматирование типа
    const getTypeLabel = (type: ScheduleVersionType) => {
        switch (type) {
            case ScheduleVersionType.TEMPLATE:
                return 'Шаблон';
            case ScheduleVersionType.PERIOD:
                return 'На период';
            case ScheduleVersionType.SUBSTITUTION:
                return 'Замены';
            default:
                return type;
        }
    };

    // Форматирование статуса. Основное и статус публикации показываются вместе,
    // поэтому у опубликованного основного расписания будет два чипа: Основное + Опубликовано.
    const getStatusChip = (status: ScheduleStatus, isActive: boolean) => {
        const chips: React.ReactNode[] = [];
        if (isActive) {
            chips.push(<Chip key="main" label="Основное" color="success" size="small" icon={<CheckCircle />} />);
        }
        if (status === ScheduleStatus.PUBLISHED) {
            chips.push(<Chip key="pub" label="Опубликовано" color="primary" size="small" />);
        } else if (status === ScheduleStatus.ARCHIVED) {
            chips.push(<Chip key="arch" label="В архиве" size="small" variant="outlined" />);
        } else if (!isActive) {
            chips.push(<Chip key="draft" label="Черновик" size="small" />);
        }
        return <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{chips}</Box>;
    };

    // Форматирование даты
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

    // Группировка: сначала шаблоны, затем на период, затем замены; с учётом фильтра
    const typeOrder: Record<string, number> = {
        [ScheduleVersionType.TEMPLATE]: 0,
        [ScheduleVersionType.PERIOD]: 1,
        [ScheduleVersionType.SUBSTITUTION]: 2,
    };
    const visibleVersions = versions
        .filter((v) => typeFilter === 'all' || v.type === typeFilter)
        .slice()
        .sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            {/* Заголовок */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip title="Вернуться в основное приложение">
                        <IconButton onClick={() => navigate('/dashboard')} sx={{ mr: -1 }}>
                            <Home />
                        </IconButton>
                    </Tooltip>
                    <Schedule color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4">Расписание</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<Settings />}
                        onClick={() => navigate('/schedule/manage')}
                    >
                        Настройки
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        Создать расписание
                    </Button>
                </Box>
            </Box>

            {/* Ошибка */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Фильтр по типу */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {([
                    { v: 'all', label: 'Все' },
                    { v: ScheduleVersionType.TEMPLATE, label: 'Шаблоны' },
                    { v: ScheduleVersionType.PERIOD, label: 'На период' },
                    { v: ScheduleVersionType.SUBSTITUTION, label: 'Замены' },
                ] as { v: 'all' | ScheduleVersionType; label: string }[]).map((f) => (
                    <Chip
                        key={f.v}
                        label={f.label}
                        color={typeFilter === f.v ? 'primary' : 'default'}
                        variant={typeFilter === f.v ? 'filled' : 'outlined'}
                        onClick={() => setTypeFilter(f.v)}
                        clickable
                    />
                ))}
            </Box>

            {/* Таблица расписаний */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Название</TableCell>
                            <TableCell>Тип</TableCell>
                            <TableCell>Неделя</TableCell>
                            <TableCell>Период</TableCell>
                            <TableCell>Статус</TableCell>
                            <TableCell>Создано</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleVersions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">
                                        Расписания не созданы
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Add />}
                                        onClick={() => setCreateDialogOpen(true)}
                                        sx={{ mt: 2 }}
                                    >
                                        Создать первое расписание
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ) : (
                            visibleVersions.map((version) => (
                                <TableRow
                                    key={version.id}
                                    hover
                                    onClick={() => navigate(`/schedule/editor/${version.id}`)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {version.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {version.type === ScheduleVersionType.SUBSTITUTION ? (
                                            <Chip size="small" color="secondary" icon={<SwapHoriz />} label={getTypeLabel(version.type)} />
                                        ) : (
                                            getTypeLabel(version.type)
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {version.weekType === WeekType.SINGLE ? 'Одна' : 'Чёт/Нечёт'}
                                        {' · '}
                                        {(version as any).workingDays === WORKING_DAYS_6 ? '6 дн' : '5 дн'}
                                    </TableCell>
                                    <TableCell>
                                        {version.startDate || version.endDate ? (
                                            <>
                                                {formatDate(version.startDate)} — {formatDate(version.endDate)}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusChip(version.status, version.isActive)}
                                    </TableCell>
                                    <TableCell>{formatDate(version.createdAt)}</TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            onClick={(e) => handleMenuOpen(e, version)}
                                        >
                                            <MoreVert />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Меню действий */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => {
                    handleMenuClose();
                    if (selectedVersion) navigate(`/schedule/editor/${selectedVersion.id}`);
                }}>
                    <Edit fontSize="small" sx={{ mr: 1 }} />
                    Редактировать
                </MenuItem>
                <MenuItem onClick={() => {
                    handleMenuClose();
                    if (selectedVersion) navigate(`/schedule/view/${selectedVersion.id}`);
                }}>
                    <Visibility fontSize="small" sx={{ mr: 1 }} />
                    Просмотр
                </MenuItem>
                <MenuItem onClick={handleCopy}>
                    <ContentCopy fontSize="small" sx={{ mr: 1 }} />
                    Копировать
                </MenuItem>
                {selectedVersion?.type !== ScheduleVersionType.SUBSTITUTION && (
                    <MenuItem onClick={handleCreateSubstitution}>
                        <SwapHoriz fontSize="small" sx={{ mr: 1 }} />
                        Создать замены
                    </MenuItem>
                )}
                {selectedVersion?.status === ScheduleStatus.DRAFT && (
                    <MenuItem onClick={handlePublish}>
                        <Publish fontSize="small" sx={{ mr: 1 }} />
                        Опубликовать
                    </MenuItem>
                )}
                {selectedVersion?.status === ScheduleStatus.PUBLISHED && (
                    <MenuItem onClick={handleUnpublish}>
                        <Unpublished fontSize="small" sx={{ mr: 1 }} />
                        Снять с публикации
                    </MenuItem>
                )}
                {!selectedVersion?.isActive && (
                    <MenuItem onClick={handleActivate}>
                        <CheckCircle fontSize="small" sx={{ mr: 1 }} />
                        Сделать основным
                    </MenuItem>
                )}
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                    <Delete fontSize="small" sx={{ mr: 1 }} />
                    Удалить
                </MenuItem>
            </Menu>

            {/* Диалог создания */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Создать расписание</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Название"
                        value={newVersion.name}
                        onChange={(e) => setNewVersion((prev) => ({ ...prev, name: e.target.value }))}
                        sx={{ mt: 2, mb: 2 }}
                    />

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Тип расписания</InputLabel>
                        <Select
                            value={newVersion.type}
                            label="Тип расписания"
                            onChange={(e) =>
                                setNewVersion((prev) => ({
                                    ...prev,
                                    type: e.target.value as ScheduleVersionType,
                                }))
                            }
                        >
                            <MenuItem value={ScheduleVersionType.TEMPLATE}>
                                Шаблон (базовое расписание)
                            </MenuItem>
                            <MenuItem value={ScheduleVersionType.PERIOD}>
                                На период (четверть, семестр)
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Тип недели</InputLabel>
                        <Select
                            value={newVersion.weekType}
                            label="Тип недели"
                            onChange={(e) =>
                                setNewVersion((prev) => ({
                                    ...prev,
                                    weekType: e.target.value as WeekType,
                                }))
                            }
                        >
                            <MenuItem value={WeekType.SINGLE}>Однонедельное</MenuItem>
                            <MenuItem value={WeekType.ODD_EVEN}>Двухнедельное (чёт/нечёт)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* FIX #1: Выбор 5 или 6 рабочих дней */}
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Рабочих дней</InputLabel>
                        <Select
                            value={newVersion.workingDays}
                            label="Рабочих дней"
                            onChange={(e) =>
                                setNewVersion((prev) => ({
                                    ...prev,
                                    workingDays: Number(e.target.value),
                                }))
                            }
                        >
                            <MenuItem value={WORKING_DAYS_5}>5 дней (Пн—Пт)</MenuItem>
                            <MenuItem value={WORKING_DAYS_6}>6 дней (Пн—Сб)</MenuItem>
                        </Select>
                    </FormControl>

                    {/* FIX #5: Тип образовательного учреждения */}
                    <FormControl fullWidth>
                        <InputLabel>Тип учреждения</InputLabel>
                        <Select
                            value={newVersion.institutionType}
                            label="Тип учреждения"
                            onChange={(e) => {
                                const type = e.target.value as InstitutionType;
                                const t = getTerms(type);
                                setNewVersion((prev) => ({
                                    ...prev,
                                    institutionType: type,
                                    maxLessonsPerDay: t.defaultMaxLessons,
                                }));
                            }}
                        >
                            {INSTITUTION_TYPES.map((t) => (
                                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {newVersion.institutionType !== 'school' && (() => {
                            const t = getTerms(newVersion.institutionType);
                        return (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                {t.lessonLabel} = {t.defaultLessonDuration} мин ({t.academicHoursPerLesson} акад. ч.) ·{' '}
                                Макс {t.defaultMaxLessons} {t.lessonLabelPlural.toLowerCase()} в день ·{' '}
                                {t.classLabelPlural}, {t.teacherLabelPlural.toLowerCase()}, {t.roomLabelPlural.toLowerCase()}
                            </Typography>
                        );
                    })()}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={!newVersion.name.trim()}
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ScheduleDashboard;
