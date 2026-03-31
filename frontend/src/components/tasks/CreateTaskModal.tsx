import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput,
    SelectChangeEvent,
    CircularProgress,
    FormControlLabel,
    Checkbox,
    Divider,
    Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { addTask } from '../../store/slices/tasksSlice';
import { tasksService } from '../../services/tasks.service';
import { CreateTaskDto } from '../../types';

interface CreateTaskModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
    open,
    onClose,
    onSuccess,
}) => {
    const { categories } = useAppSelector((state) => state.filters);
    const dispatch = useAppDispatch();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // FIX #2: Личная задача и видимость по категориям
    const [isPersonal, setIsPersonal] = useState(false);
    const [categoryOnly, setCategoryOnly] = useState(false);

    const handleCategoryChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Введите название задачи');
            return;
        }

        if (!deadlineDate) {
            setError('Выберите дату дедлайна');
            return;
        }

        // Для неличных задач нужны категории
        if (!isPersonal && selectedCategories.length === 0) {
            setError('Выберите хотя бы одну категорию');
            return;
        }

        setLoading(true);

        try {
            const time = deadlineTime || '00:00';
            const deadlineString = `${deadlineDate}T${time}`;

            const taskData: CreateTaskDto = {
                title: title.trim(),
                description: description.trim(),
                deadline: new Date(deadlineString).toISOString(),
                assigneeCategories: isPersonal ? [] : selectedCategories,
                isPersonal,
                categoryOnly: isPersonal ? false : categoryOnly,
            };

            const newTask = await tasksService.create(taskData);
            dispatch(addTask(newTask));
            onSuccess();
            handleClose();
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setError(
                Array.isArray(msg) ? msg.join(', ') : msg || 'Ошибка при создании задачи'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setDescription('');
        setDeadlineDate('');
        setDeadlineTime('');
        setSelectedCategories([]);
        setIsPersonal(false);
        setCategoryOnly(false);
        setError('');
        onClose();
    };

    // Минимальная дата - сегодня
    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>Создать новую задачу</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        {error && (
                            <Box sx={{ color: 'error.main', fontSize: '0.875rem' }}>
                                {error}
                            </Box>
                        )}

                        <TextField
                            label="Название задачи"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            fullWidth
                            autoFocus
                        />

                        <TextField
                            label="Описание"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            multiline
                            rows={4}
                            fullWidth
                        />

                        {/* Разделенные поля для даты и времени */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Дата дедлайна"
                                type="date"
                                value={deadlineDate}
                                onChange={(e) => setDeadlineDate(e.target.value)}
                                required
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: today }}
                            />
                            <TextField
                                label="Время (необязательно)"
                                type="time"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                helperText="По умолчанию 00:00"
                            />
                        </Box>

                        <Divider />

                        {/* FIX #2: Личная задача */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={isPersonal}
                                    onChange={(e) => {
                                        setIsPersonal(e.target.checked);
                                        if (e.target.checked) {
                                            setCategoryOnly(false);
                                            setSelectedCategories([]);
                                        }
                                    }}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body2">Личная задача</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Видна только вам
                                    </Typography>
                                </Box>
                            }
                        />

                        {/* Категории — скрыты для личных задач */}
                        {!isPersonal && (
                            <>
                                <FormControl fullWidth required={!isPersonal}>
                                    <InputLabel>Для кого</InputLabel>
                                    <Select
                                        multiple
                                        value={selectedCategories}
                                        onChange={handleCategoryChange}
                                        input={<OutlinedInput label="Для кого" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {categories.map((cat) => (
                                            <MenuItem key={cat.id} value={cat.categoryName}>
                                                {cat.categoryName}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* FIX #2: Видимость только для назначенных */}
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={categoryOnly}
                                            onChange={(e) => setCategoryOnly(e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body2">Только для выбранных категорий</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Задачу увидят только назначенные, создатель и администраторы
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        startIcon={loading && <CircularProgress size={20} />}
                    >
                        {loading ? 'Создание...' : 'Создать'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default CreateTaskModal;
