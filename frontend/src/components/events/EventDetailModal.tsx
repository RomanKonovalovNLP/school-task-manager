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
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/useRedux';
import { eventsService, Event, EventTask, EventAttachment } from '../../services/events.service';

interface EventDetailModalProps {
    open: boolean;
    onClose: () => void;
    event: Event | null;
    onRefresh: () => void;
    onEdit: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

    const loadTasks = useCallback(async () => {
        if (!event) return;
        try {
            const data = await eventsService.getTasks(event.id);
            setTasks(data);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
    }, [event]);

    useEffect(() => {
        if (open && event) {
            loadTasks();
        }
    }, [open, event, loadTasks]);

    const handleAddTask = async () => {
        if (!event || !newTaskTitle.trim()) return;

        setLoading(true);
        try {
            await eventsService.createTask(event.id, { title: newTaskTitle.trim() });
            setNewTaskTitle('');
            await loadTasks();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при создании задачи');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async (taskId: number) => {
        if (!event) return;

        try {
            await eventsService.toggleTaskCompletion(event.id, taskId);
            await loadTasks();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка');
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!event) return;
        if (!window.confirm('Удалить задачу?')) return;

        try {
            await eventsService.deleteTask(event.id, taskId);
            await loadTasks();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при удалении задачи');
        }
    };

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!event || !e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];

        if (file.size > MAX_FILE_SIZE) {
            setError('Размер файла превышает 10 МБ');
            return;
        }

        setUploading(true);
        try {
            await eventsService.uploadAttachment(event.id, file);
            onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при загрузке файла');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDownloadAttachment = async (attachment: EventAttachment) => {
        if (!event) return;

        try {
            await eventsService.downloadAttachment(event.id, attachment.id, attachment.originalName);
        } catch (err: any) {
            setError('Ошибка при скачивании файла');
        }
    };

    const handleDeleteAttachment = async (attachmentId: number) => {
        if (!event) return;
        if (!window.confirm('Удалить вложение?')) return;

        try {
            await eventsService.deleteAttachment(event.id, attachmentId);
            onRefresh();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при удалении вложения');
        }
    };

    const handleDelete = async () => {
        if (!event) return;
        if (!window.confirm('Удалить мероприятие? Все задачи и вложения будут удалены.')) return;

        try {
            await eventsService.delete(event.id);
            onRefresh();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при удалении');
        }
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Task color="primary" />
                        {event.title}
                    </Box>
                    <IconButton onClick={onClose}>
                        <Close />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent dividers>
                {error && (
                    <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Основная информация */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2">
                                {new Date(event.eventDate).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                                {' в '}
                                {new Date(event.eventDate).toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Person fontSize="small" color="action" />
                            <Typography variant="body2">{event.creatorName}</Typography>
                        </Box>
                    </Box>

                    {event.description && (
                        <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                            {event.description}
                        </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {event.assigneeCategories?.map((cat) => (
                            <Chip key={cat} label={cat} size="small" variant="outlined" />
                        ))}
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Вложения */}
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AttachFile /> Вложения ({event.attachments?.length || 0})
                        </Typography>
                        <Button
                            size="small"
                            startIcon={uploading ? <CircularProgress size={16} /> : <CloudUpload />}
                            onClick={handleFileSelect}
                            disabled={uploading}
                        >
                            Загрузить файл
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            onChange={handleFileUpload}
                        />
                    </Box>

                    {uploading && <LinearProgress sx={{ mb: 1 }} />}

                    {event.attachments && event.attachments.length > 0 ? (
                        <List dense>
                            {event.attachments.map((attachment) => (
                                <ListItem
                                    key={attachment.id}
                                    sx={{
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                        mb: 0.5,
                                    }}
                                >
                                    <ListItemIcon>
                                        <InsertDriveFile />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={attachment.originalName}
                                        secondary={`${formatFileSize(attachment.fileSize)} • ${attachment.uploaderName}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <Tooltip title="Скачать">
                                            <IconButton
                                                edge="end"
                                                onClick={() => handleDownloadAttachment(attachment)}
                                            >
                                                <Download />
                                            </IconButton>
                                        </Tooltip>
                                        {(canEdit || attachment.uploaderName === user?.fullName) && (
                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    edge="end"
                                                    onClick={() => handleDeleteAttachment(attachment.id)}
                                                >
                                                    <Delete />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Нет вложений
                        </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary">
                        Максимальный размер файла: 10 МБ
                    </Typography>
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
                        <LinearProgress
                            variant="determinate"
                            value={(completedTasks / totalTasks) * 100}
                            sx={{ mb: 2, height: 8, borderRadius: 4 }}
                        />
                    )}

                    {/* Добавление новой задачи */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Новая задача..."
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                            fullWidth
                        />
                        <Button
                            variant="contained"
                            onClick={handleAddTask}
                            disabled={loading || !newTaskTitle.trim()}
                            startIcon={loading ? <CircularProgress size={16} /> : <Add />}
                        >
                            Добавить
                        </Button>
                    </Box>

                    {/* Список задач */}
                    <List>
                        {tasks.map((task) => (
                            <Paper
                                key={task.id}
                                variant="outlined"
                                sx={{ mb: 1, p: 1 }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Checkbox
                                        checked={task.completedByMe}
                                        onChange={() => handleToggleTask(task.id)}
                                        icon={<RadioButtonUnchecked />}
                                        checkedIcon={<CheckCircle />}
                                        color="success"
                                    />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                textDecoration: task.completedByMe ? 'line-through' : 'none',
                                                color: task.completedByMe ? 'text.secondary' : 'text.primary',
                                            }}
                                        >
                                            {task.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {task.creatorName}
                                            {task.completionCount && task.completionCount > 0 && (
                                                <> • Выполнили: {task.completionCount}</>
                                            )}
                                        </Typography>
                                    </Box>
                                    {(canEdit || task.creatorName === user?.fullName) && (
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDeleteTask(task.id)}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                            </Paper>
                        ))}
                    </List>

                    {tasks.length === 0 && (
                        <Typography variant="body2" color="text.secondary" align="center">
                            Нет задач
                        </Typography>
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                {canEdit && (
                    <>
                        <Button
                            color="error"
                            onClick={handleDelete}
                            startIcon={<Delete />}
                        >
                            Удалить
                        </Button>
                        <Button
                            onClick={onEdit}
                            startIcon={<Edit />}
                        >
                            Редактировать
                        </Button>
                    </>
                )}
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};

export default EventDetailModal;
