import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
    FormControl, InputLabel, Select, MenuItem, TextField, Divider, FormControlLabel,
    Checkbox, CircularProgress, Alert, Chip,
} from '@mui/material';
import { scheduleService } from '../../services/schedule.service';
import { ScheduleLesson, Subject, Substitution, DAYS_OF_WEEK, isDayWorking, WorkloadWeekType } from '../../types/schedule';

interface Props {
    open: boolean;
    onClose: () => void;
    lesson: ScheduleLesson | null;
    date: string;
    isOddEven: boolean;
    subjects: Subject[];
    workingDays: number;
    maxLessons: number;
    existing?: Substitution | null;
    onSaved: () => void;
}

type AvailTeacher = { id: number; name: string; subjects: string[]; currentLoad: number; suitability: number };
type AvailRoom = { id: number; name: string; capacity: number; type: string };

const SubstitutionModal: React.FC<Props> = ({ open, onClose, lesson, date, isOddEven, subjects, workingDays, maxLessons, existing, onSaved }) => {
    const [targetDay, setTargetDay] = useState(0);
    const [targetLesson, setTargetLesson] = useState(0);
    const [weekType, setWeekType] = useState<string>('both');
    const [teacherId, setTeacherId] = useState<number | ''>('');
    const [subjectId, setSubjectId] = useState<number | ''>('');
    const [roomId, setRoomId] = useState<number | ''>('');
    const [isWindow, setIsWindow] = useState(false);
    const [reason, setReason] = useState('');

    const [teachers, setTeachers] = useState<AvailTeacher[]>([]);
    const [rooms, setRooms] = useState<AvailRoom[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Инициализация при открытии
    useEffect(() => {
        if (!open || !lesson) return;
        setTargetDay(existing?.newDayOfWeek || lesson.dayOfWeek);
        setTargetLesson(existing?.newLessonNumber || lesson.lessonNumber);
        setWeekType(existing?.newWeekType || lesson.weekType || 'both');
        setTeacherId(existing?.newTeacherId ?? '');
        setSubjectId(existing?.newSubjectId ?? '');
        setRoomId(existing?.newRoomId ?? '');
        setIsWindow(existing?.isCancelled || false);
        setReason(existing?.reason || '');
        setError(null);
    }, [open, lesson, existing]);

    // Подгрузка доступных учителей/кабинетов для целевой позиции
    const loadAvailable = useCallback(async () => {
        if (!lesson || !targetDay || !targetLesson) return;
        setLoading(true);
        try {
            const res = await scheduleService.getAvailableForSlot(lesson.id, targetDay, targetLesson, date);
            setTeachers(res.availableTeachers);
            setRooms(res.availableRooms);
            // Если выбранный учитель/кабинет больше не доступен на новой позиции — сбрасываем
            setTeacherId((cur) => (cur && !res.availableTeachers.some(t => t.id === cur) ? '' : cur));
            setRoomId((cur) => (cur && !res.availableRooms.some(r => r.id === cur) ? '' : cur));
        } catch {
            setTeachers([]); setRooms([]);
        } finally {
            setLoading(false);
        }
    }, [lesson, targetDay, targetLesson, date]);

    useEffect(() => {
        if (open && !isWindow) loadAvailable();
    }, [open, isWindow, loadAvailable]);

    if (!lesson) return null;

    const w = lesson.workload;
    const origTeacher = w?.teacher?.shortName || w?.teacher?.fullName || '—';
    const origSubject = w?.subject?.name || '—';
    const origRoom = lesson.room?.name || '—';
    const origClass = w?.schoolClass?.name || '—';
    const dayName = (n: number) => DAYS_OF_WEEK.find(d => d.num === n)?.short || String(n);

    const positionChanged = targetDay !== lesson.dayOfWeek || targetLesson !== lesson.lessonNumber || (isOddEven && weekType !== (lesson.weekType || 'both'));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            await scheduleService.createSubstitution({
                lessonId: lesson.id,
                date,
                isCancelled: isWindow,
                newTeacherId: isWindow ? undefined : (teacherId || undefined),
                newSubjectId: isWindow ? undefined : (subjectId || undefined),
                newRoomId: isWindow ? undefined : (roomId || undefined),
                newDayOfWeek: !isWindow && positionChanged ? targetDay : undefined,
                newLessonNumber: !isWindow && positionChanged ? targetLesson : undefined,
                newWeekType: !isWindow && positionChanged ? weekType : undefined,
                reason: reason || undefined,
            });
            onSaved();
            onClose();
        } catch (err: any) {
            const m = err?.response?.data?.message;
            setError(typeof m === 'string' ? m : Array.isArray(m) ? m.join(', ') : 'Не удалось сохранить замену');
        } finally {
            setSaving(false);
        }
    };

    const days = DAYS_OF_WEEK.filter(d => d.num <= 7 && isDayWorking(workingDays, d.num));
    const lessonNums = Array.from({ length: maxLessons }, (_, i) => i + 1);
    const prettyDate = new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Замена на {prettyDate}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {/* Слева — исходный урок (не редактируется) */}
                    <Box sx={{ flex: '1 1 250px', minWidth: 240 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Было</Typography>
                        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Row label="Класс" value={origClass} />
                            <Row label="Позиция" value={`${dayName(lesson.dayOfWeek)}, ${lesson.lessonNumber} урок`} />
                            <Row label="Предмет" value={origSubject} />
                            <Row label="Учитель" value={origTeacher} />
                            <Row label="Кабинет" value={origRoom} />
                        </Box>
                    </Box>

                    {/* Справа — на что заменить */}
                    <Box sx={{ flex: '1 1 280px', minWidth: 260 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Стало</Typography>

                        <FormControlLabel
                            control={<Checkbox checked={isWindow} onChange={(e) => setIsWindow(e.target.checked)} />}
                            label="Окно (освободить ячейку)"
                        />

                        {!isWindow && (
                            <>
                                {isOddEven && (
                                    <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
                                        <InputLabel>Неделя</InputLabel>
                                        <Select value={weekType} label="Неделя" onChange={(e) => setWeekType(e.target.value)}>
                                            <MenuItem value="both">Обе</MenuItem>
                                            <MenuItem value="odd">Нечётная</MenuItem>
                                            <MenuItem value="even">Чётная</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}

                                <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: isOddEven ? 0 : 1 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>День</InputLabel>
                                        <Select value={targetDay || ''} label="День" onChange={(e) => setTargetDay(Number(e.target.value))}>
                                            {days.map(d => <MenuItem key={d.num} value={d.num}>{d.name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Урок</InputLabel>
                                        <Select value={targetLesson || ''} label="Урок" onChange={(e) => setTargetLesson(Number(e.target.value))}>
                                            {lessonNums.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Box>

                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                    <InputLabel>Учитель (свободные)</InputLabel>
                                    <Select value={teacherId} label="Учитель (свободные)" onChange={(e) => setTeacherId(Number(e.target.value) || '')}
                                        endAdornment={loading ? <CircularProgress size={16} sx={{ mr: 3 }} /> : undefined}>
                                        <MenuItem value=""><em>— оставить прежнего —</em></MenuItem>
                                        {teachers.map(t => (
                                            <MenuItem key={t.id} value={t.id}>
                                                {t.name}{t.suitability >= 100 ? ' ✓' : ''}{` · нагрузка ${t.currentLoad}`}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                    <InputLabel>Предмет</InputLabel>
                                    <Select value={subjectId} label="Предмет" onChange={(e) => setSubjectId(Number(e.target.value) || '')}>
                                        <MenuItem value=""><em>— оставить прежний —</em></MenuItem>
                                        {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                    <InputLabel>Кабинет (свободные)</InputLabel>
                                    <Select value={roomId} label="Кабинет (свободные)" onChange={(e) => setRoomId(Number(e.target.value) || '')}>
                                        <MenuItem value=""><em>— оставить прежний —</em></MenuItem>
                                        {rooms.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </>
                        )}

                        <TextField fullWidth size="small" label="Причина (необязательно)" value={reason}
                            onChange={(e) => setReason(e.target.value)} placeholder="Больничный, командировка..." />

                        {!isWindow && positionChanged && (
                            <Chip size="small" color="info" sx={{ mt: 1.5 }}
                                label={`Перенос: ${dayName(targetDay)}, ${targetLesson} урок`} />
                        )}
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}
                    startIcon={saving ? <CircularProgress size={16} /> : undefined}>
                    Сохранить замену
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right', ml: 1 }}>{value}</Typography>
    </Box>
);

export default SubstitutionModal;
