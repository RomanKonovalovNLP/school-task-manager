import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Box,
    OutlinedInput,
    Autocomplete,
    Alert,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    Typography,
} from '@mui/material';
import { Person } from '@mui/icons-material';
import { Task } from '../../types';
import { tasksService } from '../../services/tasks.service';
import { filtersService } from '../../services/filters.service';
import { authService } from '../../services/auth.service';

interface EditTaskModalProps {
    open: boolean;
    task: Task | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
    open,
    task,
    onClose,
    onSuccess,
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: number; fullName: string }[]>([]);
    const [restrictAttachments, setRestrictAttachments] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        if (!open) return;
        // Справочник сотрудников доступен всем пользователям (не только админам),
        // чтобы любой мог назначить задачу конкретному человеку
        authService.getUsersDirectory()
            .then((list) => setAllUsers(list || []))
            .catch(() => setAllUsers([]));
    }, [open]);

    type Target = { type: 'category' | 'user'; value: string; label: string };
    const targetOptions: Target[] = React.useMemo(() => [
        ...availableCategories.map((c) => ({ type: 'category' as const, value: c, label: c })),
        ...allUsers.map((u) => ({ type: 'user' as const, value: u.fullName, label: u.fullName })),
    ], [availableCategories, allUsers]);
    const selectedTargets: Target[] = React.useMemo(() => [
        ...categories.map((v) => ({ type: 'category' as const, value: v, label: v })),
        ...selectedUsers.map((v) => ({ type: 'user' as const, value: v, label: v })),
    ], [categories, selectedUsers]);
    const handleTargetsChange = (_e: any, val: Target[]) => {
        setCategories(val.filter((o) => o.type === 'category').map((o) => o.value));
        setSelectedUsers(val.filter((o) => o.type === 'user').map((o) => o.value));
    };

    useEffect(() => {
        if (task && open) {
            setTitle(task.title);
            setDescription(task.description || '');

            // Преобразуем дату в формат datetime-local (YYYY-MM-DDTHH:mm)
            const date = new Date(task.deadline);
            const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            setDeadline(localDate);

            // Категории из task
            setCategories(task.assigneeCategories || []);
            setSelectedUsers(task.assigneeUsers || []);
            setRestrictAttachments(!!task.restrictAttachments);
            setError(null);
        }
    }, [task, open]);

    const loadCategories = async () => {
        try {
            const cats = await filtersService.getAll();
            setAvailableCategories(cats.map((c) => c.categoryName));
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

    const handleSubmit = async () => {
        if (!task) return;

        if (!title.trim()) {
            setError('Название задачи обязательно');
            return;
        }

        if (!deadline) {
            setError('Дедлайн обязателен');
            return;
        }

        if (categories.length === 0 && selectedUsers.length === 0) {
            setError('Выберите хотя бы одну категорию или человека');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await tasksService.update(task.id, {
                title,
                description,
                deadline,
                assigneeCategories: categories,
                assigneeUsers: selectedUsers,
                restrictAttachments,
            });
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при обновлении задачи');
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = (event: any) => {
        const value = event.target.value;
        setCategories(typeof value === 'string' ? value.split(',') : value);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Редактировать задачу</DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <TextField
                    label="Название задачи"
                    fullWidth
                    margin="normal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                />

                <TextField
                    label="Описание"
                    fullWidth
                    margin="normal"
                    multiline
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                />

                <TextField
                    label="Срок выполнения"
                    type="datetime-local"
                    fullWidth
                    margin="normal"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                    disabled={loading}
                />

                <Autocomplete
                    multiple
                    disableCloseOnSelect
                    disabled={loading}
                    options={targetOptions}
                    value={selectedTargets}
                    onChange={handleTargetsChange}
                    groupBy={(o) => (o.type === 'category' ? 'Категории' : 'Персонально')}
                    getOptionLabel={(o) => o.label}
                    isOptionEqualToValue={(o, v) => o.type === v.type && o.value === v.value}
                    noOptionsText="Ничего не найдено"
                    openOnFocus
                    ListboxProps={{ style: { maxHeight: 240 } }}
                    componentsProps={{ popper: { placement: 'bottom-start', modifiers: [{ name: 'flip', enabled: false }, { name: 'preventOverflow', enabled: true, options: { altAxis: true, padding: 8 } }] } }}
                    renderTags={(value, getTagProps) =>
                        value.map((o, index) => (
                            <Chip
                                {...getTagProps({ index })}
                                key={`${o.type}-${o.value}`}
                                size="small"
                                label={o.label}
                                color={o.type === 'user' ? 'secondary' : 'default'}
                                icon={o.type === 'user' ? <Person sx={{ fontSize: '0.9rem' }} /> : undefined}
                            />
                        ))
                    }
                    sx={{ mt: 2 }}
                    renderInput={(params) => (
                        <TextField {...params} label="Для кого" placeholder="Поиск категории или человека…" />
                    )}
                    fullWidth
                />

                {/* Ограничение видимости вложений */}
                <FormControlLabel
                    sx={{ mt: 1, alignItems: 'flex-start' }}
                    control={
                        <Checkbox
                            checked={restrictAttachments}
                            onChange={(e) => setRestrictAttachments(e.target.checked)}
                            disabled={loading}
                        />
                    }
                    label={
                        <Box>
                            <Typography variant="body2">
                                Скрыть вложения пользователей от других
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Файлы, прикреплённые пользователями, увидят только создатель задачи и
                                администраторы. Файлы, прикреплённые вами, видны всем.
                            </Typography>
                        </Box>
                    }
                />
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Отмена
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !title || !deadline || (categories.length === 0 && selectedUsers.length === 0)}
                >
                    {loading ? <CircularProgress size={24} /> : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditTaskModal;
