import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    IconButton,
    TextField,
    Checkbox,
    CircularProgress,
    Alert,
    Tooltip,
    LinearProgress,
    Paper,
    Collapse,
} from '@mui/material';
import {
    AccessTime,
    Person,
    AttachFile,
    Delete,
    Download,
    Add,
    CheckCircle,
    RadioButtonUnchecked,
    Edit,
    Close,
    CloudUpload,
    Task,
    InsertDriveFile,
    Schedule,
    ExpandMore,
    ExpandLess,
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/useRedux';
import { eventsService, Event, EventTask, EventAttachment, AgendaItem } from '../../services/events.service';

interface EventDetailModalProps {
    open: boolean;
    onClose: () => void;
    event: Event | null;
    onRefresh: () => void;
    onEdit: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EventDetailModal: React.FC<EventDetailModalProps> = ({
    open,
    onClose,
    event,
    onRefresh,
    onEdit,
}) => {
    const { user } = useAppSelector((state) => state.auth);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [tasks, setTasks] = useState<EventTask[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    // Agenda
    const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
    const [newAgendaTitle, setNewAgendaTitle] = useState('');
    const [newAgendaStart, setNewAgendaStart] = useState('');
    const [newAgendaEnd, setNewAgendaEnd] = useState('');
    const [expandedAgendaId, setExpandedAgendaId] = useState<number | null>(null);
    const [agendaNewTaskTitle, setAgendaNewTaskTitle] = useState('');
    // FIX #1: Отдельный ID для загрузки файла к конкретному пункту расписания
    const [uploadingAgendaId, setUploadingAgendaId] = useState<number | null>(null);

    const loadTasks = useCallback(async () => {
        if (!event) return;
        try {
            const data = await eventsService.getTasks(event.id);
            setTasks(data);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
    }, [event]);

    const loadAgenda = useCallback(async () => {
        if (!event) return;
        try {
            const data = await eventsService.getAgendaItems(event.id);
            setAgendaItems(Array.isArray(data) ? data : []);
        } catch {
            setAgendaItems([]);
        }
    }, [event]);

    useEffect(() => {
        if (open && event) {
            loadTasks();
            loadAgenda();
        }
    }, [open, event, loadTasks, loadAgenda]);

    // === Задачи ===
    const handleAddTask = async () => {
        if (!event || !newTaskTitle.trim()) return;
        setLoading(true);
        try {
            await eventsService.createTask(event.id, { title: newTaskTitle.trim() });
            setNewTaskTitle('');
            await loadTasks();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка');
        } finally { setLoading(false); }
    };

    const handleToggleTask = async (taskId: number) => {
        if (!event) return;
        try { await eventsService.toggleTaskCompletion(event.id, taskId); await loadTasks(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!event || !window.confirm('Удалить задачу?')) return;
        try { await eventsService.deleteTask(event.id, taskId); await loadTasks(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    // === Вложения ===
    const handleFileSelect = () => { fileInputRef.current?.click(); };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!event || !e.target.files?.[0]) return;
        const file = e.target.files[0];
        if (file.size > MAX_FILE_SIZE) { setError('Размер файла превышает 10 МБ'); return; }
        setUploading(true);
        try { await eventsService.uploadAttachment(event.id, file); onRefresh(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка загрузки'); }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const handleDownloadAttachment = async (attachment: EventAttachment) => {
        if (!event) return;
        try { await eventsService.downloadAttachment(event.id, attachment.id, attachment.originalName); }
        catch { setError('Ошибка при скачивании'); }
    };

    const handleDeleteAttachment = async (attachmentId: number) => {
        if (!event || !window.confirm('Удалить вложение?')) return;
        try { await eventsService.deleteAttachment(event.id, attachmentId); onRefresh(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    // === Agenda ===
    const handleAddAgendaItem = async () => {
        if (!event || !newAgendaTitle.trim()) return;
        setLoading(true);
        try {
            await eventsService.createAgendaItem(event.id, {
                title: newAgendaTitle.trim(),
                startTime: newAgendaStart || undefined,
                endTime: newAgendaEnd || undefined,
            });
            setNewAgendaTitle(''); setNewAgendaStart(''); setNewAgendaEnd('');
            await loadAgenda();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
        finally { setLoading(false); }
    };

    const handleDeleteAgendaItem = async (itemId: number) => {
        if (!event || !window.confirm('Удалить пункт расписания?')) return;
        try { await eventsService.deleteAgendaItem(event.id, itemId); await loadAgenda(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    // FIX #1: Каждый пункт расписания имеет свой <input type="file">
    const handleAgendaFileUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!event || !e.target.files?.[0]) return;
        const file = e.target.files[0];
        if (file.size > MAX_FILE_SIZE) { setError('Размер файла превышает 10 МБ'); return; }
        setUploadingAgendaId(itemId);
        try { await eventsService.uploadAgendaAttachment(event.id, itemId, file); await loadAgenda(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка загрузки'); }
        finally { setUploadingAgendaId(null); }
    };

    const handleAddAgendaTask = async (itemId: number) => {
        if (!event || !agendaNewTaskTitle.trim()) return;
        try {
            await eventsService.createAgendaTask(event.id, itemId, { title: agendaNewTaskTitle.trim() });
            setAgendaNewTaskTitle('');
            await loadAgenda();
        } catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    const handleDelete = async () => {
        if (!event || !window.confirm('Удалить мероприятие?')) return;
        try { await eventsService.delete(event.id); onRefresh(); onClose(); }
        catch (err: any) { setError(err.response?.data?.message || 'Ошибка'); }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    };

    const canEdit = user?.isAdmin || event?.creatorName === user?.fullName;

    if (!event) return null;

    const completedTasks = tasks.filter((t) => t.completedByMe).length;
    const totalTasks = tasks.length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ pr: 2 }} noWrap>{event.title}</Typography>
                    <IconButton onClick={onClose} size="small"><Close /></IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

                {/* Инфо */}
                <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2">
                                {new Date(event.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {!event.allDay && ` ${new Date(event.startDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                                {event.endDate && ` — ${new Date(event.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Person fontSize="small" color="action" />
                            <Typography variant="body2">{event.creatorName}</Typography>
                        </Box>
                    </Box>
                    {event.description && <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{event.description}</Typography>}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {event.assigneeCategories?.map((cat) => <Chip key={cat} label={cat} size="small" variant="outlined" />)}
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Вложения */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AttachFile /> Вложения ({event.attachments?.length || 0})
                        </Typography>
                        <Button size="small" startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
                            onClick={handleFileSelect} disabled={uploading}>Загрузить</Button>
                    </Box>
                    <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} />
                    {event.attachments && event.attachments.length > 0 ? (
                        <List dense>
                            {event.attachments.map((att) => (
                                <ListItem key={att.id}>
                                    <ListItemIcon><InsertDriveFile fontSize="small" /></ListItemIcon>
                                    <ListItemText primary={att.originalName} secondary={`${formatFileSize(att.fileSize)} • ${att.uploaderName}`} />
                                    <ListItemSecondaryAction>
                                        <IconButton size="small" onClick={() => handleDownloadAttachment(att)}><Download fontSize="small" /></IconButton>
                                        {canEdit && <IconButton size="small" onClick={() => handleDeleteAttachment(att.id)}><Delete fontSize="small" /></IconButton>}
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    ) : <Typography variant="body2" color="text.secondary">Нет вложений</Typography>}
                    <Typography variant="caption" color="text.secondary">Максимальный размер: 10 МБ</Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Расписание мероприятия */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Schedule /> Расписание мероприятия ({agendaItems.length})
                    </Typography>

                    {canEdit && (
                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            <TextField size="small" placeholder="Название пункта..." value={newAgendaTitle}
                                onChange={(e) => setNewAgendaTitle(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
                            <TextField size="small" type="time" label="Начало" value={newAgendaStart}
                                onChange={(e) => setNewAgendaStart(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                            <TextField size="small" type="time" label="Конец" value={newAgendaEnd}
                                onChange={(e) => setNewAgendaEnd(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
                            <Button variant="contained" size="small" onClick={handleAddAgendaItem}
                                disabled={!newAgendaTitle.trim() || loading} startIcon={<Add />}>Добавить</Button>
                        </Box>
                    )}

                    {agendaItems.map((item) => (
                        <Paper key={item.id} variant="outlined" sx={{ mb: 1 }}>
                            <Box
                                sx={{ display: 'flex', alignItems: 'center', p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                onClick={() => setExpandedAgendaId(expandedAgendaId === item.id ? null : item.id)}
                            >
                                <IconButton size="small" sx={{ mr: 1 }}>
                                    {expandedAgendaId === item.id ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                                {item.startTime && (
                                    <Chip label={`${item.startTime.slice(0, 5)}${item.endTime ? ' — ' + item.endTime.slice(0, 5) : ''}`}
                                        size="small" variant="outlined" sx={{ mr: 1 }} />
                                )}
                                <Typography variant="body1" sx={{ fontWeight: 500, flex: 1 }}>{item.title}</Typography>
                                {item.attachments && item.attachments.length > 0 && <Chip label={`${item.attachments.length} файл(ов)`} size="small" sx={{ mr: 0.5 }} />}
                                {item.tasks && item.tasks.length > 0 && <Chip label={`${item.tasks.length} задач`} size="small" sx={{ mr: 0.5 }} />}
                                {canEdit && (
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteAgendaItem(item.id); }}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>

                            <Collapse in={expandedAgendaId === item.id}>
                                <Box sx={{ px: 3, pb: 2 }}>
                                    {item.description && <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>{item.description}</Typography>}
                                    {item.responsibleNames && item.responsibleNames.length > 0 && (
                                        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, alignItems: 'center' }}>
                                            <Person fontSize="small" color="action" />
                                            <Typography variant="body2" color="text.secondary">Ответственные: {item.responsibleNames.join(', ')}</Typography>
                                        </Box>
                                    )}

                                    {/* FIX #1: Вложения пункта — свой <input> для каждого пункта */}
                                    <Box sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Typography variant="subtitle2">Вложения</Typography>
                                            <label>
                                                <input type="file" hidden
                                                    onChange={(e) => handleAgendaFileUpload(item.id, e)}
                                                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                                                />
                                                <Button size="small" variant="text" component="span"
                                                    startIcon={uploadingAgendaId === item.id ? <CircularProgress size={14} /> : <CloudUpload />}
                                                    disabled={uploadingAgendaId === item.id}>
                                                    Загрузить
                                                </Button>
                                            </label>
                                        </Box>
                                        {item.attachments && item.attachments.length > 0 ? (
                                            item.attachments.map((att) => (
                                                <Chip key={att.id} label={att.originalName} size="small" icon={<InsertDriveFile />}
                                                    onClick={() => handleDownloadAttachment(att)}
                                                    onDelete={canEdit ? () => handleDeleteAttachment(att.id) : undefined}
                                                    sx={{ mr: 0.5, mb: 0.5 }} />
                                            ))
                                        ) : <Typography variant="caption" color="text.secondary">Нет вложений</Typography>}
                                    </Box>

                                    {/* Задачи пункта */}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Задачи</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                            <TextField size="small" placeholder="Новая задача..." fullWidth
                                                value={expandedAgendaId === item.id ? agendaNewTaskTitle : ''}
                                                onChange={(e) => setAgendaNewTaskTitle(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddAgendaTask(item.id)} />
                                            <Button size="small" variant="contained" onClick={() => handleAddAgendaTask(item.id)}
                                                disabled={!agendaNewTaskTitle.trim()}><Add /></Button>
                                        </Box>
                                        {item.tasks && item.tasks.length > 0 ? (
                                            item.tasks.map((task) => (
                                                <Box key={task.id} sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                                                    <Checkbox size="small" checked={task.isCompleted}
                                                        onChange={() => handleToggleTask(task.id)}
                                                        icon={<RadioButtonUnchecked />} checkedIcon={<CheckCircle />} color="success" />
                                                    <Typography variant="body2" sx={{ flex: 1, textDecoration: task.isCompleted ? 'line-through' : 'none', color: task.isCompleted ? 'text.secondary' : 'text.primary' }}>
                                                        {task.title}
                                                    </Typography>
                                                    {canEdit && <IconButton size="small" onClick={() => handleDeleteTask(task.id)}><Delete sx={{ fontSize: 14 }} /></IconButton>}
                                                </Box>
                                            ))
                                        ) : <Typography variant="caption" color="text.secondary">Нет задач</Typography>}
                                    </Box>
                                </Box>
                            </Collapse>
                        </Paper>
                    ))}

                    {agendaItems.length === 0 && <Typography variant="body2" color="text.secondary" align="center">Расписание не добавлено</Typography>}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Задачи мероприятия */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Task /> Задачи ({completedTasks}/{totalTasks})
                        </Typography>
                    </Box>

                    {totalTasks > 0 && (
                        <LinearProgress variant="determinate" value={(completedTasks / totalTasks) * 100} sx={{ mb: 2, height: 8, borderRadius: 4 }} />
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField size="small" placeholder="Новая задача..." value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()} fullWidth />
                        <Button variant="contained" onClick={handleAddTask} disabled={loading || !newTaskTitle.trim()}
                            startIcon={loading ? <CircularProgress size={16} /> : <Add />}>Добавить</Button>
                    </Box>

                    <List>
                        {tasks.map((task) => (
                            <Paper key={task.id} variant="outlined" sx={{ mb: 1, p: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Checkbox checked={task.completedByMe} onChange={() => handleToggleTask(task.id)}
                                        icon={<RadioButtonUnchecked />} checkedIcon={<CheckCircle />} color="success" />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2"
                                            sx={{ textDecoration: task.completedByMe ? 'line-through' : 'none', color: task.completedByMe ? 'text.secondary' : 'text.primary' }}>
                                            {task.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {task.creatorName}
                                            {/* FIX #2: Показываем число выполнивших только если > 0 */}
                                            {task.completionCount != null && task.completionCount > 0 && (
                                                <> • Выполнили: {task.completionCount}</>
                                            )}
                                        </Typography>
                                    </Box>
                                    {(canEdit || task.creatorName === user?.fullName) && (
                                        <IconButton size="small" onClick={() => handleDeleteTask(task.id)}><Delete fontSize="small" /></IconButton>
                                    )}
                                </Box>
                            </Paper>
                        ))}
                    </List>

                    {tasks.length === 0 && <Typography variant="body2" color="text.secondary" align="center">Нет задач</Typography>}
                </Box>
            </DialogContent>

            <DialogActions>
                {canEdit && (
                    <>
                        <Button color="error" onClick={handleDelete} startIcon={<Delete />}>Удалить</Button>
                        <Button onClick={onEdit} startIcon={<Edit />}>Редактировать</Button>
                    </>
                )}
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};

export default EventDetailModal;
