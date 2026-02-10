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
    Archive,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { scheduleService } from '../services/schedule.service';
import {
    ScheduleVersion,
    ScheduleVersionType,
    WeekType,
    ScheduleStatus,
} from '../types/schedule';

const ScheduleDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Меню действий
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [selectedVersion, setSelectedVersion] = useState<ScheduleVersion | null>(null);
    
    // Диалог создания
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newVersion, setNewVersion] = useState({
        name: '',
        type: ScheduleVersionType.TEMPLATE,
        weekType: WeekType.SINGLE,
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
            setVersions(data.versions);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки расписаний');
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
            const created = await scheduleService.createVersion(newVersion);
            setVersions((prev) => [...prev, created]);
            setCreateDialogOpen(false);
            setNewVersion({
                name: '',
                type: ScheduleVersionType.TEMPLATE,
                weekType: WeekType.SINGLE,
            });
            // Переходим к редактированию
            navigate(`/schedule/editor/${created.id}`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка создания расписания');
        }
    };

    // Копирование версии
    const handleCopy = async () => {
        if (!selectedVersion) return;
        try {
            const copied = await scheduleService.copyVersion(
                selectedVersion.id,
                `${selectedVersion.name} (копия)`
            );
            setVersions((prev) => [...prev, copied]);
            handleMenuClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка копирования');
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
            setError(err.response?.data?.message || 'Ошибка удаления');
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
            setError(err.response?.data?.message || 'Ошибка активации');
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
            setError(err.response?.data?.message || 'Ошибка публикации');
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

    // Форматирование статуса
    const getStatusChip = (status: ScheduleStatus, isActive: boolean) => {
        if (isActive) {
            return <Chip label="Активное" color="success" size="small" icon={<CheckCircle />} />;
        }
        switch (status) {
            case ScheduleStatus.DRAFT:
                return <Chip label="Черновик" size="small" />;
            case ScheduleStatus.PUBLISHED:
                return <Chip label="Опубликовано" color="primary" size="small" />;
            case ScheduleStatus.ARCHIVED:
                return <Chip label="В архиве" size="small" variant="outlined" />;
            default:
                return null;
        }
    };

    // Форматирование даты
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU');
    };

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
                    <Schedule color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4">Расписание</Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Создать расписание
                </Button>
            </Box>

            {/* Ошибка */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

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
                        {versions.length === 0 ? (
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
                            versions.map((version) => (
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
                                    <TableCell>{getTypeLabel(version.type)}</TableCell>
                                    <TableCell>
                                        {version.weekType === WeekType.SINGLE ? 'Одна' : 'Чёт/Нечёт'}
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
                {selectedVersion?.status === ScheduleStatus.DRAFT && (
                    <MenuItem onClick={handlePublish}>
                        <Publish fontSize="small" sx={{ mr: 1 }} />
                        Опубликовать
                    </MenuItem>
                )}
                {!selectedVersion?.isActive && (
                    <MenuItem onClick={handleActivate}>
                        <CheckCircle fontSize="small" sx={{ mr: 1 }} />
                        Сделать активным
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

                    <FormControl fullWidth>
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
