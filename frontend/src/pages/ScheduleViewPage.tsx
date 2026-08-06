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
    const [bells, setBells] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('class');
    const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
    const [weekTab, setWeekTab] = useState<'odd' | 'even'>('odd');
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));

    const terms = useMemo(() => getTerms((version as any)?.institutionType || 'school'), [version]);
    const isOddEven = version?.weekType === 'odd_even';
    const isPeriod = version?.type === ScheduleVersionType.PERIOD;
    const workingDays = version?.workingDays || WORKING_DAYS_5;
    const maxLessons = version?.maxLessonsPerDay || 7;

    const effectiveMode: 'class' | 'teacher' | 'room' = viewMode;

    useEffect(() => {
        (async () => {
            try {
                const data = await scheduleService.getVersions();
                const list = Array.isArray(data) ? data : data.versions || [];
                const visible = user?.isAdmin ? list : list.filter((v: any) => v.status === 'published');
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
            const [data, cd, td, sd, rd, bd] = await Promise.all([
                scheduleService.getVersion(selectedVersionId), scheduleService.getClasses(),
                scheduleService.getTeachers(), scheduleService.getSubjects(), scheduleService.getRooms(),
                scheduleService.getBellSchedules().catch(() => []),
            ]);
            setVersion(data.version); setLessons(data.lessons);
            setClasses(Array.isArray(cd) ? cd : cd.classes || []);
            setTeachers(Array.isArray(td) ? td : td.teachers || []);
            setSubjects(Array.isArray(sd) ? sd : sd.subjects || []);
            setRooms(Array.isArray(rd) ? rd : rd.rooms || []);
            setBells(Array.isArray(bd) ? bd : (bd?.bellSchedules || bd?.bells || []));
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
    const lessonNums = useMemo(() => Array.from({ length: maxLessons }, (_, i) => i + 1), [maxLessons]);

    const weekDates = useMemo(() => {
        if (!isPeriod) return {} as Record<number, Date>;
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

    // Уроки после фильтра по неделе (чёт/нечёт)
    const weekLessons = useMemo(() => {
        let result = lessons;
        if (isOddEven && !isPeriod) result = result.filter(l => l.weekType === 'both' || l.weekType === weekTab);
        if (isOddEven && isPeriod && currentWeekNumber) {
            const wt = currentWeekNumber === 1 ? 'odd' : 'even';
            result = result.filter(l => l.weekType === 'both' || l.weekType === wt);
        }
        return result;
    }, [lessons, isOddEven, isPeriod, weekTab, currentWeekNumber]);

    // Индекс: день-урок-сущность -> уроки (для быстрой отрисовки шахматки)
    const cellIndex = useMemo(() => {
        const idOf = (l: ScheduleLesson): number | undefined => {
            const w = l.workload;
            if (effectiveMode === 'class') return w?.schoolClass?.id ?? (l as any).schoolClass?.id;
            if (effectiveMode === 'teacher') return w?.teacher?.id ?? (l as any).teacher?.id;
            return l.roomId ?? l.room?.id ?? w?.room?.id;
        };
        const m = new Map<string, ScheduleLesson[]>();
        for (const l of weekLessons) {
            const eid = idOf(l);
            if (eid == null) continue;
            const k = `${l.dayOfWeek}-${l.lessonNumber}-${eid}`;
            const arr = m.get(k); if (arr) arr.push(l); else m.set(k, [l]);
        }
        return m;
    }, [weekLessons, effectiveMode]);

    // Столбцы: классы / учителя / кабинеты (подписаны в шапке)
    const columns = useMemo(() => {
        let base: { id: number; label: string; shift?: number }[];
        if (effectiveMode === 'class') {
            base = [...classes]
                .sort((a, b) => (((a as any).shift || 1) - ((b as any).shift || 1)) || (a.gradeLevel - b.gradeLevel) || a.name.localeCompare(b.name, 'ru', { numeric: true }))
                .map(c => ({ id: c.id, label: c.name, shift: (c as any).shift || 1 }));
        } else if (effectiveMode === 'teacher') {
            base = [...teachers].sort((a, b) => (a.shortName || a.fullName).localeCompare(b.shortName || b.fullName, 'ru')).map(t => ({ id: t.id, label: t.shortName || t.fullName }));
        } else {
            base = [...rooms].sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true })).map(r => ({ id: r.id, label: r.name }));
        }
        if (selectedColumns.size > 0) base = base.filter(c => selectedColumns.has(c.id));
        return base;
    }, [effectiveMode, classes, teachers, rooms, selectedColumns]);

    // Группировка столбцов по сменам (для класса): сначала 1 смена, затем 2
    const shiftHeader = useMemo(() => {
        if (effectiveMode !== 'class') return null;
        const segs: { shift: number; span: number }[] = [];
        for (const c of columns) {
            const sh = (c as any).shift || 1;
            const last = segs[segs.length - 1];
            if (last && last.shift === sh) last.span++; else segs.push({ shift: sh, span: 1 });
        }
        return segs.length > 1 ? segs : null;
    }, [effectiveMode, columns]);

    const entityChips = useMemo(() => {
        if (effectiveMode === 'class') return classes.map(c => ({ id: c.id, label: c.name }));
        if (effectiveMode === 'teacher') return teachers.map(t => ({ id: t.id, label: t.shortName || t.fullName }));
        return rooms.map(r => ({ id: r.id, label: r.name }));
    }, [effectiveMode, classes, teachers, rooms]);

    const isDayOff = (dayNum: number) => {
        if (!isPeriod || !calendarDays.length) return false;
        const date = weekDates[dayNum]; if (!date) return false;
        const ds = date.toISOString().slice(0, 10);
        return calendarDays.find((d: any) => d.date?.slice(0, 10) === ds)?.dayType === 'holiday';
    };

    const toggleColumn = (id: number) => setSelectedColumns(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });

    const handleTabChange = (m: ViewMode) => { setViewMode(m); setSelectedColumns(new Set()); };

    const renderCell = (l: ScheduleLesson) => {
        const w = l.workload;
        const subj = w?.subject?.shortName || w?.subject?.name || '?';
        let secondary = '';
        if (effectiveMode === 'class') secondary = [w?.teacher?.shortName, l.room?.name || w?.room?.name].filter(Boolean).join(' · ');
        else if (effectiveMode === 'teacher') secondary = [w?.schoolClass?.name, l.room?.name || w?.room?.name].filter(Boolean).join(' · ');
        else secondary = [w?.schoolClass?.name, w?.teacher?.shortName].filter(Boolean).join(' · ');
        return (
            <Box key={l.id} sx={{ p: 0.5, mb: 0.3, borderRadius: 1, bgcolor: w?.subject?.color ? `${w.subject.color}22` : 'action.hover', borderLeft: `3px solid ${w?.subject?.color || '#999'}`, lineHeight: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', fontSize: '0.72rem' }}>
                    {subj}{w?.group?.name ? ` (${w.group.name})` : ''}
                </Typography>
                {secondary && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.66rem' }}>{secondary}</Typography>}
            </Box>
        );
    };

    const colLabel = effectiveMode === 'class' ? terms.classLabel : effectiveMode === 'teacher' ? terms.teacherLabel : terms.roomLabel;

    const bellTime = (shift: number, n: number): string => {
        const b = bells.find((x: any) => ((x.shift || 1) === shift) && x.lessonNumber === n);
        if (!b) return '';
        const t = (v?: string) => (v ? String(v).slice(0, 5) : '');
        return t(b.startTime) && t(b.endTime) ? `${t(b.startTime)}–${t(b.endTime)}` : '';
    };

    // Таблица для набора столбцов (смены выводятся отдельными таблицами)
    const renderTable = (cols: { id: number; label: string }[], shift = 1) => (
        <TableContainer component={Paper} sx={{ mb: 2, maxHeight: '75vh' }}>
            <Table size="small" stickyHeader sx={{ '& td, & th': { border: '1px solid', borderColor: 'divider' } }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', position: 'sticky', left: 0, zIndex: 3, minWidth: 40 }}>№</TableCell>
                        {cols.map(c => (
                            <TableCell key={c.id} align="center" sx={{ fontWeight: 700, bgcolor: 'primary.light', color: 'primary.contrastText', minWidth: 96 }}>
                                {c.label}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {visibleDays.map(day => {
                        const off = isDayOff(day.num);
                        const date = weekDates[day.num];
                        return (
                            <React.Fragment key={day.num}>
                                <TableRow>
                                    <TableCell colSpan={1 + cols.length} sx={{ fontWeight: 700, bgcolor: off ? 'rgba(244,67,54,0.20)' : day.num === 6 ? 'secondary.light' : 'grey.200', color: off ? 'error.main' : 'inherit', position: 'sticky', left: 0 }}>
                                        {day.name}{date ? ` · ${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}` : ''}{off ? ' — выходной' : ''}
                                    </TableCell>
                                </TableRow>
                                {!off && lessonNums.map(n => (
                                    <TableRow key={n} hover>
                                        <TableCell sx={{ fontWeight: 600, textAlign: 'center', bgcolor: 'grey.50', position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap' }}>
                                            {n}
                                            {bellTime(shift, n) && <Typography variant="caption" sx={{ display: 'block', fontWeight: 400, color: 'text.secondary', fontSize: '0.6rem' }}>{bellTime(shift, n)}</Typography>}
                                        </TableCell>
                                        {cols.map(c => {
                                            const cell = cellIndex.get(`${day.num}-${n}-${c.id}`) || [];
                                            return (
                                                <TableCell key={c.id} sx={{ p: 0.3, verticalAlign: 'top' }}>
                                                    {cell.map(renderCell)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );

    if (loading && !version) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

    return (
        <Container maxWidth={false} sx={{ py: 3 }}>
            <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Tooltip title="На главную"><IconButton onClick={() => navigate('/dashboard')}><Home /></IconButton></Tooltip>
                <CalendarMonth color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h4">Расписание</Typography>
                {versions.length > 1 && (
                    <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>Версия</InputLabel>
                        <Select value={selectedVersionId || ''} label="Версия" onChange={(e) => setSelectedVersionId(Number(e.target.value))}>
                            {versions.map(v => <MenuItem key={v.id} value={v.id}>{v.name} {(v as any).isActive ? '(основная)' : ''}</MenuItem>)}
                        </Select></FormControl>
                )}
                {user?.isAdmin && <Box sx={{ ml: 'auto' }}><Chip label="Управление" variant="outlined" clickable onClick={() => navigate('/schedule/admin')} /></Box>}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} className="no-print">{error}</Alert>}
            {versions.length === 0 && !loading && (
                <Alert severity="info" className="no-print">
                    {user?.isAdmin
                        ? 'Нет опубликованных версий расписания. Опубликуйте расписание в разделе «Управление», чтобы оно стало видно педагогам.'
                        : 'Нет опубликованных версий расписания (обратитесь к администратору школы).'}
                </Alert>
            )}

            {version && (
                <>
                    <Paper className="no-print" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={viewMode} onChange={(_, v) => handleTabChange(v)} variant="scrollable" scrollButtons="auto">
                            <Tab value="class" label={terms.byClassTab} />
                            <Tab value="teacher" label={terms.byTeacherTab} />
                            <Tab value="room" label={terms.byRoomTab} />
                        </Tabs>
                    </Paper>

                    {/* Фильтр столбцов + печать */}
                    <Box className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                            Показать {colLabel.toLowerCase()}:
                        </Typography>
                        {entityChips.map(c => (
                            <Chip key={c.id} label={c.label} size="small"
                                variant={selectedColumns.has(c.id) ? 'filled' : 'outlined'}
                                color={selectedColumns.has(c.id) ? 'primary' : 'default'}
                                onClick={() => toggleColumn(c.id)} sx={{ cursor: 'pointer' }} />
                        ))}
                        {selectedColumns.size > 0 && <Chip label="Сбросить" size="small" onClick={() => setSelectedColumns(new Set())} />}
                        {selectedColumns.size === 0 && <Typography variant="caption" color="text.secondary">(показаны все)</Typography>}
                    </Box>

                    {isPeriod && <Box className="no-print" sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setCurrentWeekStart}
                        minDate={version.startDate ? new Date(version.startDate) : undefined} maxDate={version.endDate ? new Date(version.endDate) : undefined} weekNumber={currentWeekNumber} /></Box>}
                    {isOddEven && !isPeriod && (
                        <Paper className="no-print" sx={{ mb: 2, display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>
                            <Tabs value={weekTab} onChange={(_, v) => setWeekTab(v)}>
                                <Tab value="odd" label="I неделя (нечётная)" sx={{ bgcolor: weekTab === 'odd' ? '#e3f2fd' : 'transparent' }} />
                                <Tab value="even" label="II неделя (чётная)" sx={{ bgcolor: weekTab === 'even' ? '#fce4ec' : 'transparent' }} />
                            </Tabs>
                        </Paper>
                    )}

                    <Box>
                        {columns.length === 0 ? (
                            <Alert severity="info" className="no-print">Нет данных для отображения. Выберите {colLabel.toLowerCase()} выше.</Alert>
                        ) : effectiveMode === 'class' ? (
                            [1, 2].map((sh) => {
                                const cols = columns.filter((c) => ((c as any).shift || 1) === sh);
                                if (cols.length === 0) return null;
                                return (
                                    <Box key={sh} sx={{ mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Chip size="small" color={sh === 2 ? 'secondary' : 'primary'} label={`${sh} смена`} sx={{ fontWeight: 600 }} />
                                        </Box>
                                        {renderTable(cols, sh)}
                                    </Box>
                                );
                            })
                        ) : (
                            renderTable(columns, 1)
                        )}
                        <Typography variant="caption" color="text.secondary">
                            {version.name}{isPeriod && version.startDate && version.endDate ? ` · ${new Date(version.startDate).toLocaleDateString('ru-RU')} — ${new Date(version.endDate).toLocaleDateString('ru-RU')}` : ''}
                            {isOddEven ? ' · Двухнедельное' : ''}{(version as any).institutionType && (version as any).institutionType !== 'school' ? ` · ${terms.label}` : ''}
                        </Typography>
                    </Box>
                </>
            )}
        </Container>
    );
};

export default ScheduleViewPage;
