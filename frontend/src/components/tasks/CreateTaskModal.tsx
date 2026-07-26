import { useCelebration } from '../celebration/CelebrationProvider';
import React, { useState, useEffect } from 'react';
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
    Autocomplete,
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
import { Person } from '@mui/icons-material';
import { authService } from '../../services/auth.service';
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
    const celebrate = useCelebration();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [deadlineDate, setDeadlineDate] = useState('');
    const [deadlineTime, setDeadlineTime] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<{ id: number; fullName: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        // Справочник сотрудников доступен всем пользователям (не только админам),
        // чтобы любой мог назначить задачу конкретному человеку
        authService.getUsersDirectory()
            .then((list) => setAllUsers(list || []))
            .catch(() => setAllUsers([]));
    }, [open]);

    // FIX #2: Личная задача и видимость по категориям
    const [isPersonal, setIsPersonal] = useState(false);
    const [categoryOnly, setCategoryOnly] = useState(false);
    // Ограничение видимости вложений от обычных пользователей
    const [restrictAttachments, setRestrictAttachments] = useState(false);
    const [isImportant, setIsImportant] = useState(false);
    const [recurrence, setRecurrence] = useState('none');
    const [recurrenceUntil, setRecurrenceUntil] = useState('');

    const handleCategoryChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
    };

    // Единый список «Для кого»: сначала категории, затем персонально люди (с поиском)
    type Target = { type: 'category' | 'user'; value: string; label: string };
    const targetOptions: Target[] = React.useMemo(() => [
        ...categories.map((c) => ({ type: 'category' as const, value: c.categoryName, label: c.categoryName })),
        ...allUsers.map((u) => ({ type: 'user' as const, value: u.fullName, label: u.fullName })),
    ], [categories, allUsers]);
    const selectedTargets: Target[] = React.useMemo(() => [
        ...selectedCategories.map((v) => ({ type: 'category' as const, value: v, label: v })),
        ...selectedUsers.map((v) => ({ type: 'user' as const, value: v, label: v })),
    ], [selectedCategories, selectedUsers]);
    const handleTargetsChange = (_e: any, val: Target[]) => {
        setSelectedCategories(val.filter((o) => o.type === 'category').map((o) => o.value));
        setSelectedUsers(val.filter((o) => o.type === 'user').map((o) => o.value));
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

        // Для неличных задач нужны получатели: категории или конкретные люди
        if (!isPersonal && selectedCategories.length === 0 && selectedUsers.length === 0) {
            setError('Выберите хотя бы одну категорию или человека');
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
                assigneeUsers: isPersonal ? [] : selectedUsers,
                isPersonal,
                categoryOnly: isPersonal ? false : categoryOnly,
                restrictAttachments: isPersonal ? false : restrictAttachments,
                isImportant,
                recurrence: recurrence !== 'none' ? recurrence : undefined,
                recurrenceUntil: recurrence !== 'none' && recurrenceUntil ? recurrenceUntil : undefined,
            };

            const newTask = await tasksService.create(taskData);
            dispatch(addTask(newTask));
            onSuccess();
            handleClose();
            celebrate({ variant: 'task', message: 'Задача успешно создана!' });
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
        setSelectedCategories([]); setSelectedUsers([]);
        setIsPersonal(false);
        setCategoryOnly(false);
        setRestrictAttachments(false);
        setIsImportant(false);
        setRecurrence('none');
        setRecurrenceUntil('');
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
                                            setSelectedCategories([]); setSelectedUsers([]);
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

                        {/* Ручной приоритет */}
                        <FormControlLabel
                            control={<Checkbox checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} />}
                            label={
                                <Box>
                                    <Typography variant="body2">Важная</Typography>
                                    <Typography variant="caption" color="text.secondary">Высокий приоритет независимо от срока</Typography>
                                </Box>
                            }
                        />

                        {/* Повторение */}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            <FormControl size="small" sx={{ minWidth: 190 }}>
                                <InputLabel>Повторять</InputLabel>
                                <Select value={recurrence} label="Повторять" onChange={(e) => setRecurrence(e.target.value)}>
                                    <MenuItem value="none">Не повторять</MenuItem>
                                    <MenuItem value="daily">Ежедневно</MenuItem>
                                    <MenuItem value="weekly">Еженедельно</MenuItem>
                                    <MenuItem value="monthly">Ежемесячно</MenuItem>
                                </Select>
                            </FormControl>
                            {recurrence !== 'none' && (
                                <TextField size="small" type="date" label="Повторять до" InputLabelProps={{ shrink: true }}
                                    value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} />
                            )}
                        </Box>
                        {recurrence !== 'none' && !recurrenceUntil && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
                                Если не указать дату, задачи будут созданы до конца учебного года (31 мая).
                            </Typography>
                        )}

                        {/* Категории — скрыты для личных задач */}
                        {!isPersonal && (
                            <>
                                <Autocomplete
                                    multiple
                                    disableCloseOnSelect
                                    options={targetOptions}
                                    value={selectedTargets}
                                    onChange={handleTargetsChange}
                                    groupBy={(o) => (o.type === 'category' ? 'Категории' : 'Персонально')}
                                    getOptionLabel={(o) => o.label}
                                    isOptionEqualToValue={(o, v) => o.type === v.type && o.value === v.value}
                                    noOptionsText="Ничего не найдено"
                                    openOnFocus
                                    ListboxProps={{ style: { maxHeight: 240 } }}
                                    componentsProps={{
                                        popper: {
                                            placement: 'bottom-start',
                                            modifiers: [
                                                // не переворачиваем вверх, но держим список в пределах экрана,
                                                // чтобы был виден целиком до конца
                                                { name: 'flip', enabled: false },
                                                { name: 'preventOverflow', enabled: true, options: { altAxis: true, padding: 8 } },
                                            ],
                                        },
                                    }}
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
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Для кого"
                                            placeholder="Поиск категории или человека…"
                                            required={!isPersonal && selectedTargets.length === 0}
                                        />
                                    )}
                                    fullWidth
                                />

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
                                            <Typography variant="body2">Видна только назначенным (категориям и людям)</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Задачу увидят только назначенные, создатель и администраторы
                                            </Typography>
                                        </Box>
                                    }
                                />

                                {/* Ограничение видимости вложений */}
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={restrictAttachments}
                                            onChange={(e) => setRestrictAttachments(e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body2">
                                                Скрыть вложения пользователей от других
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Файлы, прикреплённые пользователями, увидят только создатель
                                                задачи и администраторы. Файлы, прикреплённые вами, видны всем.
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
