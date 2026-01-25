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
    SelectChangeEvent,
    CircularProgress,
    Alert,
    FormControlLabel,
    Checkbox,
    Typography,
    Divider,
} from '@mui/material';
import { useAppSelector } from '../../hooks/useRedux';
import { eventsService, Event, CreateEventDto } from '../../services/events.service';

interface CreateEventModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editEvent?: Event | null;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({
    open,
    onClose,
    onSuccess,
    editEvent,
}) => {
    const { categories } = useAppSelector((state) => state.filters);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    // ✅ НОВОЕ: Раздельные поля для начала и окончания
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [allDay, setAllDay] = useState(false);
    const [hasEndDate, setHasEndDate] = useState(false);
    
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (open) {
            if (editEvent) {
                setTitle(editEvent.title);
                setDescription(editEvent.description || '');
                
                // Парсим даты
                const start = new Date(editEvent.startDate || editEvent.eventDate);
                setStartDate(start.toISOString().split('T')[0]);
                setStartTime(start.toTimeString().slice(0, 5));
                setAllDay(editEvent.allDay || false);
                
                if (editEvent.endDate) {
                    const end = new Date(editEvent.endDate);
                    setEndDate(end.toISOString().split('T')[0]);
                    setEndTime(end.toTimeString().slice(0, 5));
                    setHasEndDate(true);
                } else {
                    setEndDate('');
                    setEndTime('');
                    setHasEndDate(false);
                }
                
                setSelectedCategories(editEvent.assigneeCategories || []);
            } else {
                resetForm();
            }
        }
    }, [open, editEvent]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setAllDay(false);
        setHasEndDate(false);
        setSelectedCategories([]);
        setError('');
    };

    const handleCategoryChange = (event: SelectChangeEvent<string[]>) => {
        const value = event.target.value;
        setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
    };

    const handleAllDayChange = (checked: boolean) => {
        setAllDay(checked);
        if (checked) {
            setStartTime('00:00');
            setEndTime('23:59');
        }
    };

    const handleHasEndDateChange = (checked: boolean) => {
        setHasEndDate(checked);
        if (!checked) {
            setEndDate('');
            setEndTime('');
        } else if (startDate) {
            // По умолчанию ставим ту же дату
            setEndDate(startDate);
            if (!allDay) {
                // Добавляем час к времени начала
                const [hours, minutes] = startTime.split(':').map(Number);
                const endHours = Math.min(hours + 1, 23);
                setEndTime(`${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('Введите название мероприятия');
            return;
        }

        if (!startDate) {
            setError('Выберите дату начала мероприятия');
            return;
        }

        if (!allDay && !startTime) {
            setError('Укажите время начала');
            return;
        }

        if (hasEndDate && !endDate) {
            setError('Выберите дату окончания');
            return;
        }

        if (hasEndDate && !allDay && !endTime) {
            setError('Укажите время окончания');
            return;
        }

        if (selectedCategories.length === 0) {
            setError('Выберите хотя бы одну категорию');
            return;
        }

        // Проверка что дата окончания не раньше даты начала
        if (hasEndDate) {
            const startDateTime = new Date(`${startDate}T${allDay ? '00:00' : startTime}`);
            const endDateTime = new Date(`${endDate}T${allDay ? '23:59' : endTime}`);
            if (endDateTime < startDateTime) {
                setError('Дата окончания не может быть раньше даты начала');
                return;
            }
        }

        setLoading(true);

        try {
            const startDateTime = allDay 
                ? `${startDate}T00:00:00`
                : `${startDate}T${startTime}:00`;
            
            let endDateTime: string | undefined;
            if (hasEndDate) {
                endDateTime = allDay 
                    ? `${endDate}T23:59:59`
                    : `${endDate}T${endTime}:00`;
            }
            
            const eventData: CreateEventDto = {
                title: title.trim(),
                description: description.trim() || undefined,
                startDate: new Date(startDateTime).toISOString(),
                endDate: endDateTime ? new Date(endDateTime).toISOString() : undefined,
                allDay,
                assigneeCategories: selectedCategories,
            };

            if (editEvent) {
                await eventsService.update(editEvent.id, eventData);
            } else {
                await eventsService.create(eventData);
            }

            onSuccess();
            handleClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка при сохранении мероприятия');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>
                    {editEvent ? 'Редактировать мероприятие' : 'Создать мероприятие'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        {error && (
                            <Alert severity="error" onClose={() => setError('')}>
                                {error}
                            </Alert>
                        )}

                        <TextField
                            label="Название мероприятия"
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
                            rows={3}
                            fullWidth
                        />

                        <Divider />
                        
                        {/* ✅ НОВОЕ: Чекбокс "Весь день" */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allDay}
                                    onChange={(e) => handleAllDayChange(e.target.checked)}
                                />
                            }
                            label="Мероприятие на весь день"
                        />

                        {/* Дата и время начала */}
                        <Typography variant="subtitle2" color="text.secondary">
                            Начало мероприятия
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Дата начала"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ min: today }}
                            />
                            {!allDay && (
                                <TextField
                                    label="Время начала"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    required
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            )}
                        </Box>

                        {/* ✅ НОВОЕ: Чекбокс для включения даты окончания */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={hasEndDate}
                                    onChange={(e) => handleHasEndDateChange(e.target.checked)}
                                />
                            }
                            label="Указать дату и время окончания"
                        />

                        {/* Дата и время окончания (если включено) */}
                        {hasEndDate && (
                            <>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Окончание мероприятия
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <TextField
                                        label="Дата окончания"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        required
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: startDate || today }}
                                    />
                                    {!allDay && (
                                        <TextField
                                            label="Время окончания"
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            required
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    )}
                                </Box>
                            </>
                        )}

                        <Divider />

                        <FormControl fullWidth required>
                            <InputLabel>Для кого / Участники</InputLabel>
                            <Select
                                multiple
                                value={selectedCategories}
                                onChange={handleCategoryChange}
                                input={<OutlinedInput label="Для кого / Участники" />}
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
                        {loading ? 'Сохранение...' : editEvent ? 'Сохранить' : 'Создать'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default CreateEventModal;
