import React, { useEffect, useState, useRef } from 'react';
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
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    Checkbox,
    FormControlLabel,
    CircularProgress,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    Close,
    Visibility,
    AccessTime,
    Person,
    Description,
    Edit,
    AttachFile,
    CloudUpload,
    Download,
    Delete,
    InsertDriveFile,
    CheckCircle,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { setSelectedTask } from '../../store/slices/tasksSlice';
import { tasksService, TaskAttachment } from '../../services/tasks.service';
import {
    getPriorityColor,
    getPriorityLabel,
    formatDateTime,
} from '../../utils/taskHelpers';
import { TaskView } from '../../types';
import EditTaskModal from './EditTaskModal';

interface TaskModalProps {
    onRefresh: () => void;
}

// Форматирование размера файла
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// НОВОЕ: Интерфейс для детального статуса выполнения
interface CompletionStatusDetailed {
    completed: boolean;
    completionCount: number;
    completedBy?: { fullName: string; completedAt: string }[];
}

const TaskModal: React.FC<TaskModalProps> = ({ onRefresh }) => {
    const { selectedTask } = useAppSelector((state) => state.tasks);
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();

    const [views, setViews] = useState<TaskView[]>([]);
    const [showViews, setShowViews] = useState(false);

    // Состояния для completion (ОБНОВЛЕНО)
    const [completed, setCompleted] = useState(false);
    const [completionCount, setCompletionCount] = useState(0);
    const [completedBy, setCompletedBy] = useState<{ fullName: string; completedAt: string }[]>([]);
    const [loadingCompletion, setLoadingCompletion] = useState(false);
    const [showCompletedBy, setShowCompletedBy] = useState(false);

    // Состояние для модалки редактирования
    const [editModalOpen, setEditModalOpen] = useState(false);

    // Состояния для вложений
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedTask && !selectedTask.viewedByUser) {
            const markView = async () => {
                try {
                    await tasksService.markAsViewed(selectedTask.id);
                    onRefresh();
                } catch (error) {
                    console.error('Failed to mark task as viewed:', error);
                }
            };
            markView();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask]);

    // Загрузка статуса выполнения и вложений
    useEffect(() => {
        if (selectedTask) {
            loadCompletionStatus();
            loadAttachments();
            setShowViews(false);
            setShowCompletedBy(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask]);

    // ОБНОВЛЕНО: Загрузка детального статуса выполнения
    const loadCompletionStatus = async () => {
        if (!selectedTask) return;

        setLoadingCompletion(true);
        try {
            const status: CompletionStatusDetailed = await tasksService.getCompletionStatus(selectedTask.id);
            setCompleted(status.completed);
            setCompletionCount(status.completionCount);
            setCompletedBy(status.completedBy || []);
        } catch (error) {
            console.error('Failed to load completion status:', error);
        } finally {
            setLoadingCompletion(false);
        }
    };

    // Загрузка вложений
    const loadAttachments = async () => {
        if (!selectedTask) return;

        setLoadingAttachments(true);
        setAttachmentError(null);
        try {
            const data = await tasksService.getAttachments(selectedTask.id);
            setAttachments(data);
        } catch (error) {
            console.error('Failed to load attachments:', error);
            setAttachmentError('Ошибка загрузки вложений');
        } finally {
            setLoadingAttachments(false);
        }
    };

    // Переключение выполнения
    const handleToggleCompletion = async () => {
        if (!selectedTask || loadingCompletion) return;

        setLoadingCompletion(true);
        try {
            const result = await tasksService.toggleCompletion(selectedTask.id);
            setCompleted(result.completed);
            // Перезагружаем статус для обновления списка выполнивших
            await loadCompletionStatus();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Ошибка при изменении статуса');
        } finally {
            setLoadingCompletion(false);
        }
    };

    // Загрузка файла
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedTask) return;

        setUploadingFile(true);
        setAttachmentError(null);
        try {
            const newAttachment = await tasksService.uploadAttachment(selectedTask.id, file);
            setAttachments((prev) => [newAttachment, ...prev]);
            onRefresh();
        } catch (error: any) {
            console.error('Failed to upload file:', error);
            setAttachmentError(error.response?.data?.message || 'Ошибка загрузки файла');
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Скачивание файла
    const handleDownloadAttachment = async (attachment: TaskAttachment) => {
        if (!selectedTask) return;

        try {
            await tasksService.downloadAttachment(
                selectedTask.id,
                attachment.id,
                attachment.originalName
            );
        } catch (error) {
            console.error('Failed to download file:', error);
            setAttachmentError('Ошибка скачивания файла');
        }
    };

    // Удаление вложения
    const handleDeleteAttachment = async (attachmentId: number) => {
        if (!selectedTask) return;

        if (!window.confirm('Удалить вложение?')) return;

        try {
            await tasksService.deleteAttachment(selectedTask.id, attachmentId);
            setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
            onRefresh();
        } catch (error: any) {
            console.error('Failed to delete attachment:', error);
            setAttachmentError(error.response?.data?.message || 'Ошибка удаления вложения');
        }
    };

    const handleClose = () => {
        dispatch(setSelectedTask(null));
    };

    const loadViews = async () => {
        if (!selectedTask) return;

        try {
            const result = await tasksService.getViews(selectedTask.id);
            setViews(result.views);
            setShowViews(true);
        } catch (error) {
            console.error('Failed to load views:', error);
        }
    };

    const handleEditSuccess = () => {
        setEditModalOpen(false);
        onRefresh();
    };

    if (!selectedTask) return null;

    const isCreator = selectedTask.creatorName === user?.fullName;
    const canViewDetails = isCreator || user?.isAdmin;

    return (
        <>
            <Dialog open={!!selectedTask} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6">{selectedTask.title}</Typography>
                            <Chip
                                label={getPriorityLabel(selectedTask.priority)}
                                size="small"
                                sx={{
                                    backgroundColor: getPriorityColor(selectedTask.priority),
                                    color: 'white',
                                }}
                            />
                        </Box>
                        <IconButton onClick={handleClose}>
                            <Close />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Информация о дедлайне и создателе */}
                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AccessTime color="action" />
                                <Typography variant="body2">
                                    {formatDateTime(selectedTask.deadline)}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Person color="action" />
                                <Typography variant="body2">{selectedTask.creatorName}</Typography>
                            </Box>
                        </Box>

                        {/* Описание */}
                        {selectedTask.description && (
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Description color="action" />
                                    <Typography variant="body2" color="text.secondary">
                                        Описание
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        whiteSpace: 'pre-wrap',
                                        bgcolor: 'grey.50',
                                        p: 2,
                                        borderRadius: 1,
                                    }}
                                >
                                    {selectedTask.description}
                                </Typography>
                            </Box>
                        )}

                        <Divider />

                        {/* Чекбокс выполнения (ОБНОВЛЕНО) */}
                        <Box>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={completed}
                                        onChange={handleToggleCompletion}
                                        disabled={loadingCompletion}
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Выполнено {completionCount > 0 && `(${completionCount} чел.)`}
                                    </Typography>
                                }
                            />

                            {/* НОВОЕ: Показываем кто выполнил для создателя/админа */}
                            {canViewDetails && completedBy.length > 0 && (
                                <Box sx={{ mt: 1, ml: 4 }}>
                                    {!showCompletedBy ? (
                                        <Button
                                            size="small"
                                            onClick={() => setShowCompletedBy(true)}
                                            startIcon={<CheckCircle />}
                                        >
                                            Показать кто выполнил
                                        </Button>
                                    ) : (
                                        <Box>
                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Выполнили:
                                            </Typography>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                {completedBy.map((person, index) => (
                                                    <Tooltip
                                                        key={index}
                                                        title={`Выполнено: ${formatDateTime(person.completedAt)}`}
                                                    >
                                                        <Chip
                                                            size="small"
                                                            icon={<CheckCircle />}
                                                            label={person.fullName}
                                                            color="success"
                                                            variant="outlined"
                                                        />
                                                    </Tooltip>
                                                ))}
                                            </Box>
                                            <Button
                                                size="small"
                                                onClick={() => setShowCompletedBy(false)}
                                                sx={{ mt: 1 }}
                                            >
                                                Скрыть
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>

                        <Divider />

                        {/* Секция вложений */}
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AttachFile color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    Вложения ({attachments.length})
                                </Typography>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                                <Button
                                    size="small"
                                    startIcon={uploadingFile ? <CircularProgress size={16} /> : <CloudUpload />}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingFile}
                                >
                                    Загрузить
                                </Button>
                            </Box>

                            {attachmentError && (
                                <Alert severity="error" sx={{ mb: 1 }} onClose={() => setAttachmentError(null)}>
                                    {attachmentError}
                                </Alert>
                            )}

                            {loadingAttachments ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : attachments.length > 0 ? (
                                <List dense sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
                                    {attachments.map((attachment) => (
                                        <ListItem key={attachment.id}>
                                            <ListItemIcon>
                                                <InsertDriveFile />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={attachment.originalName}
                                                secondary={`${formatFileSize(attachment.fileSize)} • ${attachment.uploaderName} • ${formatDateTime(attachment.uploadedAt)}`}
                                            />
                                            <ListItemSecondaryAction>
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => handleDownloadAttachment(attachment)}
                                                    title="Скачать"
                                                >
                                                    <Download />
                                                </IconButton>
                                                {(user?.isAdmin || isCreator || attachment.uploaderName === user?.fullName) && (
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        onClick={() => handleDeleteAttachment(attachment.id)}
                                                        title="Удалить"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                )}
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                    Нет вложений
                                </Typography>
                            )}
                        </Box>

                        <Divider />

                        {/* Категории */}
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Категории:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {selectedTask.assignees && selectedTask.assignees.length > 0 ? (
                                    selectedTask.assignees.map((assignee) => (
                                        <Chip key={assignee.id} label={assignee.assigneeCategory} />
                                    ))
                                ) : (
                                    selectedTask.assigneeCategories?.map((category) => (
                                        <Chip key={category} label={category} />
                                    ))
                                )}
                            </Box>
                        </Box>

                        {/* Просмотры (только для создателя/админа) */}
                        {canViewDetails && (
                            <Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Visibility color="action" />
                                        <Typography variant="body2" color="text.secondary">
                                            Просмотры: {selectedTask.viewsCount}
                                        </Typography>
                                    </Box>
                                    {!showViews && (
                                        <Button size="small" onClick={loadViews}>
                                            Показать просмотревших
                                        </Button>
                                    )}
                                </Box>

                                {showViews && views.length > 0 && (
                                    <List dense>
                                        {views.map((view, index) => (
                                            <ListItem key={index}>
                                                <ListItemText
                                                    primary={view.viewerName}
                                                    secondary={formatDateTime(view.viewedAt)}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </Box>
                        )}

                        {/* Кнопка редактирования (только для создателя или админа) */}
                        {(isCreator || user?.isAdmin) && (
                            <Box>
                                <Button
                                    variant="outlined"
                                    startIcon={<Edit />}
                                    onClick={() => setEditModalOpen(true)}
                                    fullWidth
                                >
                                    Редактировать задачу
                                </Button>
                            </Box>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Модалка редактирования */}
            <EditTaskModal
                open={editModalOpen}
                task={selectedTask}
                onClose={() => setEditModalOpen(false)}
                onSuccess={handleEditSuccess}
            />
        </>
    );
};

export default TaskModal;
