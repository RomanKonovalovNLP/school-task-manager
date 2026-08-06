import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, IconButton, Button, Chip,
    CircularProgress, Alert, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
    ArrowBack, ArrowForward, EventBusy, EventAvailable, Schedule,
} from '@mui/icons-material';
import { scheduleService } from '../../services/schedule.service';

export interface CalendarDay {
    id?: number;
    versionId: number;
    date: string;
    dayType: 'working' | 'holiday' | 'shortened';
    maxLessons?: number | null;
    weekNumber?: number | null;
    note?: string | null;
}

interface CalendarEditorProps {
    versionId: number;
    startDate: string;
    endDate: string;
    readOnly?: boolean;
    onDaysChanged?: () => void;
}

const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Полупрозрачные заливки: на светлом фоне выглядят как пастель,
// на тёмном — как приглушённый оттенок того же цвета.
const DAY_COLORS: Record<string, string> = {
    working: 'rgba(76,175,80,0.20)',
    holiday: 'rgba(244,67,54,0.20)',
    shortened: 'rgba(255,152,0,0.22)',
};

const CalendarEditor: React.FC<CalendarEditorProps> = ({
    versionId, startDate, endDate, readOnly, onDaysChanged,
}) => {
    const [days, setDays] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(startDate));
    const [shortenedDialog, setShortenedDialog] = useState<{ date: string; maxLessons: number } | null>(null);

    const loadDays = useCallback(async () => {
        try {
            setLoading(true);
            const data = await scheduleService.getCalendarDays(versionId);
            setDays(Array.isArray(data) ? data : []);
        } catch {
            setError('Ошибка загрузки календаря');
        } finally {
            setLoading(false);
        }
    }, [versionId]);

    useEffect(() => { loadDays(); }, [loadDays]);

    const generateCalendar = async () => {
        try {
            setLoading(true);
            await scheduleService.generateCalendar(versionId, startDate, endDate);
            await loadDays();
            onDaysChanged?.();
        } catch {
            setError('Ошибка генерации календаря');
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = async (dateStr: string) => {
        if (readOnly) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(dateStr) < today) return; // Прошедшие дни нельзя менять

        const existing = days.find(d => d.date.slice(0, 10) === dateStr);
        const current = existing?.dayType || 'working';

        // Цикл: working → holiday → shortened → working
        let next: 'working' | 'holiday' | 'shortened';
        if (current === 'working') next = 'holiday';
        else if (current === 'holiday') {
            next = 'shortened';
            setShortenedDialog({ date: dateStr, maxLessons: 4 });
            return;
        } else next = 'working';

        try {
            await scheduleService.updateCalendarDay(versionId, dateStr, next);
            await loadDays();
            onDaysChanged?.();
        } catch {
            setError('Ошибка обновления');
        }
    };

    const handleShortenedSave = async () => {
        if (!shortenedDialog) return;
        try {
            await scheduleService.updateCalendarDay(
                versionId, shortenedDialog.date, 'shortened', shortenedDialog.maxLessons,
            );
            setShortenedDialog(null);
            await loadDays();
            onDaysChanged?.();
        } catch { setError('Ошибка'); }
    };

    const getDayData = (dateStr: string): CalendarDay | undefined => {
        return days.find(d => d.date.slice(0, 10) === dateStr);
    };

    // Навигация по месяцам
    const prevMonth = () => setCurrentMonth(p => { const d = new Date(p); d.setMonth(d.getMonth() - 1); return d; });
    const nextMonth = () => setCurrentMonth(p => { const d = new Date(p); d.setMonth(d.getMonth() + 1); return d; });

    // Генерация сетки месяца
    const renderMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7; // 0=Пн

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cells: React.ReactNode[] = [];

        // Пустые ячейки до начала месяца
        for (let i = 0; i < startDow; i++) {
            cells.push(<Box key={`empty-${i}`} sx={{ width: 44, height: 44 }} />);
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayData = getDayData(dateStr);
            const dayType = dayData?.dayType || 'working';
            const isPast = new Date(dateStr) < today;
            const isInPeriod = new Date(dateStr) >= new Date(startDate) && new Date(dateStr) <= new Date(endDate);
            const weekNum = dayData?.weekNumber;

            cells.push(
                <Tooltip key={dateStr}
                    title={`${dateStr}${dayType === 'holiday' ? ' — Выходной' : dayType === 'shortened' ? ` — Сокращённый (макс ${dayData?.maxLessons || '?'})` : ' — Рабочий'}${dayData?.note ? ` (${dayData.note})` : ''}${weekNum ? ` · ${weekNum === 1 ? 'I' : 'II'} нед.` : ''}`}
                >
                    <Box
                        onClick={() => isInPeriod && !isPast && toggleDay(dateStr)}
                        sx={{
                            width: 44, height: 44,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            borderRadius: 1,
                            bgcolor: isInPeriod ? DAY_COLORS[dayType] : 'grey.100',
                            opacity: isPast ? 0.5 : isInPeriod ? 1 : 0.3,
                            cursor: isInPeriod && !isPast && !readOnly ? 'pointer' : 'default',
                            border: dateStr === today.toISOString().slice(0, 10) ? '2px solid' : '1px solid',
                            borderColor: dateStr === today.toISOString().slice(0, 10) ? 'primary.main' : 'divider',
                            transition: 'all 0.15s',
                            '&:hover': isInPeriod && !isPast && !readOnly ? { boxShadow: 2 } : {},
                            position: 'relative',
                        }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: 1 }}>
                            {d}
                        </Typography>
                        {weekNum && (
                            <Typography variant="caption" sx={(theme) => ({
                                fontSize: '0.5rem', lineHeight: 1,
                                color: theme.palette.mode === 'dark'
                                    ? (weekNum === 1 ? '#64b5f6' : '#ef9a9a')
                                    : (weekNum === 1 ? '#1565c0' : '#c62828'),
                            })}>
                                {weekNum === 1 ? 'I' : 'II'}
                            </Typography>
                        )}
                    </Box>
                </Tooltip>
            );
        }

        return cells;
    };

    // Статистика
    const workingDays = days.filter(d => d.dayType === 'working').length;
    const holidays = days.filter(d => d.dayType === 'holiday').length;
    const shortened = days.filter(d => d.dayType === 'shortened').length;

    if (loading && days.length === 0) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            {days.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        Календарь не сгенерирован. Нажмите кнопку чтобы создать рабочие дни для периода {startDate} — {endDate}.
                    </Typography>
                    <Button variant="contained" onClick={generateCalendar} disabled={loading}>
                        Сгенерировать календарь
                    </Button>
                </Box>
            )}

            {days.length > 0 && (
                <>
                    {/* Навигация по месяцам */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                        <IconButton onClick={prevMonth}><ArrowBack /></IconButton>
                        <Typography variant="h6" sx={{ minWidth: 180, textAlign: 'center' }}>
                            {MONTHS_RU[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </Typography>
                        <IconButton onClick={nextMonth}><ArrowForward /></IconButton>
                    </Box>

                    {/* Заголовки дней недели */}
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mb: 0.5 }}>
                        {WEEKDAYS_SHORT.map((d, i) => (
                            <Box key={d} sx={{ width: 44, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, color: i >= 5 ? 'error.main' : 'text.primary' }}>
                                    {d}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* Сетка дней */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mb: 2 }}>
                        {renderMonth()}
                    </Box>

                    {/* Легенда и статистика */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Chip icon={<EventAvailable />} label={`Рабочие: ${workingDays}`}
                            sx={{ bgcolor: DAY_COLORS.working }} size="small" />
                        <Chip icon={<EventBusy />} label={`Выходные: ${holidays}`}
                            sx={{ bgcolor: DAY_COLORS.holiday }} size="small" />
                        <Chip icon={<Schedule />} label={`Сокращённые: ${shortened}`}
                            sx={{ bgcolor: DAY_COLORS.shortened }} size="small" />
                    </Box>

                    {!readOnly && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                            Нажмите на день чтобы переключить: рабочий → выходной → сокращённый. Прошедшие дни нельзя изменять.
                        </Typography>
                    )}
                </>
            )}

            {/* Диалог для сокращённого дня */}
            <Dialog open={!!shortenedDialog} onClose={() => setShortenedDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Сокращённый день</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Укажите максимальное количество уроков/пар для {shortenedDialog?.date}
                    </Typography>
                    <TextField type="number" fullWidth label="Макс. уроков/пар"
                        value={shortenedDialog?.maxLessons || ''}
                        onChange={(e) => setShortenedDialog(prev => prev ? { ...prev, maxLessons: Number(e.target.value) } : null)}
                        inputProps={{ min: 1, max: 10 }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setShortenedDialog(null); }}>Отмена</Button>
                    <Button variant="contained" onClick={handleShortenedSave}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CalendarEditor;
