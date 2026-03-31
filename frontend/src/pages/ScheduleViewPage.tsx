import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Container, Typography, Paper, Tabs, Tab, Chip,
    CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip,
} from '@mui/material';
import { Home, CalendarMonth } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useRedux';
import { scheduleService } from '../services/schedule.service';
import {
    ScheduleVersion, ScheduleLesson, SchoolClass, Teacher, Subject, Room,
    DAYS_OF_WEEK, isDayWorking, WORKING_DAYS_5, ScheduleVersionType,
} from '../types/schedule';
import { getTerms } from '../utils/institutionTypes';
import WeekNavigator, { getMonday } from '../components/schedule/WeekNavigator';

type ViewMode = 'class' | 'teacher' | 'room';

const ScheduleViewPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAppSelector((state) => state.auth);

    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
    const [version, setVersion] = useState<ScheduleVersion | null>(null);
    const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [calendarDays, setCalendarDays] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('class');
    const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
    const [weekTab, setWeekTab] = useState<'odd' | 'even'>('odd');
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));

    const terms = useMemo(() => getTerms((version as any)?.institutionType || 'school'), [version]);
    const isOddEven = version?.weekType === 'odd_even';
    const isPeriod = version?.type === ScheduleVersionType.PERIOD;
    const workingDays = version?.workingDays || WORKING_DAYS_5;
    const maxLessons = version?.maxLessonsPerDay || 7;

    useEffect(() => {
        (async () => {
            try {
                const data = await scheduleService.getVersions();
                const list = Array.isArray(data) ? data : data.versions || [];
                const visible = user?.isAdmin ? list : list.filter((v: any) => v.isActive || v.status === 'published');
                setVersions(visible);
                const active = visible.find((v: any) => v.isActive);
                if (active) setSelectedVersionId(active.id);
                else if (visible.length > 0) setSelectedVersionId(visible[0].id);
            } catch { setError('Ошибка загрузки'); } finally { setLoading(false); }
        })();
    }, [user]);

    const loadVersion = useCallback(async () => {
        if (!selectedVersionId) return;
        try {
            setLoading(true); setError(null);
            const [data, cd, td, sd, rd] = await Promise.all([
                scheduleService.getVersion(selectedVersionId), scheduleService.getClasses(),
                scheduleService.getTeachers(), scheduleService.getSubjects(), scheduleService.getRooms(),
            ]);
            setVersion(data.version); setLessons(data.lessons);
            setClasses(Array.isArray(cd) ? cd : cd.classes || []);
            setTeachers(Array.isArray(td) ? td : td.teachers || []);
            setSubjects(Array.isArray(sd) ? sd : sd.subjects || []);
            setRooms(Array.isArray(rd) ? rd : rd.rooms || []);
            if (data.version?.type === ScheduleVersionType.PERIOD) {
                try { const cal = await scheduleService.getCalendarDays(selectedVersionId); setCalendarDays(Array.isArray(cal) ? cal : []); } catch { setCalendarDays([]); }
                if (data.version.startDate) {
                    const start = getMonday(new Date(data.version.startDate));
                    const today = getMonday(new Date());
                    const end = data.version.endDate ? new Date(data.version.endDate) : new Date();
                    setCurrentWeekStart(today >= start && today <= end ? today : start);
                }
            }
        } catch { setError('Ошибка загрузки расписания'); } finally { setLoading(false); }
    }, [selectedVersionId]);

    useEffect(() => { loadVersion(); }, [loadVersion]);

    const visibleDays = useMemo(() => DAYS_OF_WEEK.filter(d => d.num <= 7 && isDayWorking(workingDays, d.num)), [workingDays]);

    const weekDates = useMemo(() => {
        if (!isPeriod) return {};
        const dates: Record<number, Date> = {};
        for (let i = 0; i < 7; i++) { const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); const iso = d.getDay() === 0 ? 7 : d.getDay(); dates[iso] = d; }
        return dates;
    }, [currentWeekStart, isPeriod]);

    const currentWeekNumber = useMemo(() => {
        if (!isOddEven || !isPeriod || !calendarDays.length) return null;
        const ms = currentWeekStart.toISOString().slice(0, 10);
        const md = calendarDays.find((d: any) => d.date?.slice(0, 10) === ms);
        return md?.weekNumber || null;
    }, [isOddEven, isPeriod, calendarDays, currentWeekStart]);

    const filteredLessons = useMemo(() => {
        let result = lessons;
        if (selectedEntity) {
            result = result.filter(l => { const w = l.workload;
                if (viewMode === 'class') return w?.schoolClass?.id === selectedEntity || l.schoolClass?.id === selectedEntity;
                if (viewMode === 'teacher') return w?.teacher?.id === selectedEntity || l.teacher?.id === selectedEntity;
                if (viewMode === 'room') return l.roomId === selectedEntity || l.room?.id === selectedEntity || w?.room?.id === selectedEntity;
                return true; });
        }
        if (isOddEven && !isPeriod) result = result.filter(l => l.weekType === 'both' || l.weekType === weekTab);
        if (isOddEven && isPeriod && currentWeekNumber) {
            const wt = currentWeekNumber === 1 ? 'odd' : 'even';
            result = result.filter(l => l.weekType === 'both' || l.weekType === wt);
        }
        return result;
    }, [lessons, selectedEntity, viewMode, isOddEven, isPeriod, weekTab, currentWeekNumber]);

    const isDayOff = (dayNum: number) => {
        if (!isPeriod || !calendarDays.length) return false;
        const date = weekDates[dayNum]; if (!date) return false;
        const ds = date.toISOString().slice(0, 10);
        return calendarDays.find((d: any) => d.date?.slice(0, 10) === ds)?.dayType === 'holiday';
    };

    const getCellLessons = (day: number, n: number) => filteredLessons.filter(l => l.dayOfWeek === day && l.lessonNumber === n);

    const renderLesson = (lesson: ScheduleLesson) => {
        const w = lesson.workload;
        return (
            <Box key={lesson.id} sx={{ p: 0.5, mb: 0.3, borderRadius: 1, bgcolor: w?.subject?.color ? `${w.subject.color}20` : 'action.hover', borderLeft: `3px solid ${w?.subject?.color || '#999'}`, fontSize: '0.75rem', lineHeight: 1.3 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                    {w?.subject?.shortName || w?.subject?.name || '?'}{w?.group?.name ? ` (${w.group.name})` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {viewMode !== 'teacher' && (w?.teacher?.shortName || '')}{viewMode !== 'room' && (lesson.room?.name || w?.room?.name) ? `${viewMode !== 'teacher' && w?.teacher?.shortName ? ' · ' : ''}${lesson.room?.name || w?.room?.name}` : ''}
                    {viewMode !== 'class' && w?.schoolClass?.name ? ` · ${w.schoolClass.name}` : ''}
                </Typography>
            </Box>
        );
    };

    if (loading && !version) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Tooltip title="На главную"><IconButton onClick={() => navigate('/dashboard')}><Home /></IconButton></Tooltip>
                <CalendarMonth color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h4">Расписание</Typography>
                {versions.length > 1 && (
                    <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel>Версия</InputLabel>
                        <Select value={selectedVersionId || ''} label="Версия" onChange={(e) => setSelectedVersionId(Number(e.target.value))}>
                            {versions.map(v => <MenuItem key={v.id} value={v.id}>{v.name} {(v as any).isActive ? '(активная)' : ''}</MenuItem>)}
                        </Select></FormControl>
                )}
                {user?.isAdmin && <Box sx={{ ml: 'auto' }}><Chip label="Управление" variant="outlined" clickable onClick={() => navigate('/schedule/admin')} /></Box>}
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {versions.length === 0 && !loading && <Alert severity="info">Расписание ещё не опубликовано.</Alert>}
            {version && (
                <>
                    <Paper sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={viewMode} onChange={(_, v) => { setViewMode(v); setSelectedEntity(null); }}>
                            <Tab value="class" label={terms.byClassTab} /><Tab value="teacher" label={terms.byTeacherTab} /><Tab value="room" label={terms.byRoomTab} />
                        </Tabs>
                    </Paper>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                        {viewMode === 'class' && classes.map(c => <Chip key={c.id} label={c.name} size="small" variant={selectedEntity === c.id ? 'filled' : 'outlined'} color={selectedEntity === c.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === c.id ? null : c.id)} sx={{ cursor: 'pointer' }} />)}
                        {viewMode === 'teacher' && teachers.map(t => <Chip key={t.id} label={t.shortName || t.fullName} size="small" variant={selectedEntity === t.id ? 'filled' : 'outlined'} color={selectedEntity === t.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === t.id ? null : t.id)} sx={{ cursor: 'pointer' }} />)}
                        {viewMode === 'room' && rooms.map(r => <Chip key={r.id} label={r.name} size="small" variant={selectedEntity === r.id ? 'filled' : 'outlined'} color={selectedEntity === r.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === r.id ? null : r.id)} sx={{ cursor: 'pointer' }} />)}
                    </Box>
                    {isPeriod && <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setCurrentWeekStart}
                        minDate={version.startDate ? new Date(version.startDate) : undefined} maxDate={version.endDate ? new Date(version.endDate) : undefined} weekNumber={currentWeekNumber} /></Box>}
                    {isOddEven && !isPeriod && (
                        <Paper sx={{ mb: 2, display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>
                            <Tabs value={weekTab} onChange={(_, v) => setWeekTab(v)}>
                                <Tab value="odd" label="I неделя (нечётная)" sx={{ bgcolor: weekTab === 'odd' ? '#e3f2fd' : 'transparent' }} />
                                <Tab value="even" label="II неделя (чётная)" sx={{ bgcolor: weekTab === 'even' ? '#fce4ec' : 'transparent' }} />
                            </Tabs>
                        </Paper>
                    )}
                    <TableContainer component={Paper} sx={{ mb: 3 }}>
                        <Table size="small" sx={{ tableLayout: 'fixed' }}>
                            <TableHead><TableRow>
                                <TableCell sx={{ width: 50, fontWeight: 600 }}>№</TableCell>
                                {visibleDays.map(d => {
                                    const date = weekDates[d.num]; const off = isDayOff(d.num);
                                    return <TableCell key={d.num} align="center" sx={{ fontWeight: 600, bgcolor: off ? '#ffcdd2' : d.num === 6 ? 'secondary.light' : 'primary.light', color: off ? '#b71c1c' : d.num === 6 ? 'secondary.contrastText' : 'primary.contrastText' }}>
                                        {d.name}{date && <Typography variant="caption" sx={{ display: 'block', opacity: 0.9, fontWeight: 400 }}>{date.getDate()}.{String(date.getMonth()+1).padStart(2,'0')}</Typography>}
                                        {off && <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem' }}>выходной</Typography>}
                                    </TableCell>;
                                })}
                            </TableRow></TableHead>
                            <TableBody>
                                {Array.from({ length: maxLessons }, (_, i) => i + 1).map(n => (
                                    <TableRow key={n} sx={{ '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                                        <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>{n}</TableCell>
                                        {visibleDays.map(d => {
                                            const off = isDayOff(d.num);
                                            return <TableCell key={d.num} sx={{ p: 0.5, verticalAlign: 'top', minHeight: 60, bgcolor: off ? '#ffebee' : undefined }}>
                                                {!off && getCellLessons(d.num, n).map(renderLesson)}
                                            </TableCell>;
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Typography variant="caption" color="text.secondary">
                        {version.name}{isPeriod && version.startDate && version.endDate ? ` · ${new Date(version.startDate).toLocaleDateString('ru-RU')} — ${new Date(version.endDate).toLocaleDateString('ru-RU')}` : ''}
                        {isOddEven ? ' · Двухнедельное' : ''}{(version as any).institutionType && (version as any).institutionType !== 'school' ? ` · ${terms.label}` : ''}
                    </Typography>
                </>
            )}
        </Container>
    );
};

export default ScheduleViewPage;
