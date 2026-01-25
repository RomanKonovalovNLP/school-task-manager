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
    Alert,
    CircularProgress,
} from '@mui/material';
import { Task } from '../../types';
import { tasksService } from '../../services/tasks.service';
import { filtersService } from '../../services/filters.service';

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadCategories();
    }, []);

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

        if (categories.length === 0) {
            setError('Выберите хотя бы одну категорию');
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

                <FormControl fullWidth margin="normal" disabled={loading}>
                    <InputLabel>Категории исполнителей</InputLabel>
                    <Select
                        multiple
                        value={categories}
                        onChange={handleCategoryChange}
                        input={<OutlinedInput label="Категории исполнителей" />}
                        renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                    <Chip key={value} label={value} size="small" />
                                ))}
                            </Box>
                        )}
                    >
                        {availableCategories.map((cat) => (
                            <MenuItem key={cat} value={cat}>
                                {cat}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Отмена
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={loading || !title || !deadline || categories.length === 0}
                >
                    {loading ? <CircularProgress size={24} /> : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditTaskModal;