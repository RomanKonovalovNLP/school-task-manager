import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, Tabs, Tab, Chip,
    Alert, CircularProgress, Drawer, TextField, InputAdornment,
    List, ListItem, ListItemText, ListItemButton,
} from '@mui/material';
import {
    Undo, Redo, PlayArrow, Warning, Error as ErrorIcon,
    CheckCircle, Download, Refresh, ArrowBack, Search, Close,
    SwapHoriz, Delete,
} from '@mui/icons-material';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ScheduleGrid from './ScheduleGrid';
import WorkloadPanel from './WorkloadPanel';
import ConflictPanel from './ConflictPanel';
import AutoGenerateModal from './AutoGenerateModal';
import ExportModal from './ExportModal';
import SubstitutionModal from './SubstitutionModal';
import { scheduleService } from '../../services/schedule.service';
import {
    ScheduleVersion, ScheduleLesson, Workload, ScheduleConflict,
    SchoolClass, Teacher, Subject, Room, WorkloadWeekType, Substitution, DAYS_OF_WEEK,
} from '../../types/schedule';
import { getTerms } from '../../utils/institutionTypes';

interface ScheduleEditorProps { versionId: number; onBack?: () => void; }
type ViewMode = 'class' | 'teacher' | 'room';

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ versionId, onBack }) => {
    const getErr = (e: any, fb: string) => { const m = e.response?.data?.message; return Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : fb; };

    const [version, setVersion] = useState<ScheduleVersion | null>(null);
    const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
    const [workloads, setWorkloads] = useState<Workload[]>([]);
    const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('class');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showUnplacedOnly, setShowUnplacedOnly] = useState(false);
    const [showConflicts, setShowConflicts] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [weekTab, setWeekTab] = useState<'all' | 'odd' | 'even'>('all');
    const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [conflictPanelOpen, setConflictPanelOpen] = useState(false);
    const [suggestSlots, setSuggestSlots] = useState<{ workloadId: number; slots: any[] } | null>(null);
    const [history, setHistory] = useState<ScheduleLesson[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // === Замены ===
    const [subs, setSubs] = useState<Substitution[]>([]);
    const [subDate, setSubDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [subModalOpen, setSubModalOpen] = useState(false);
    const [subLesson, setSubLesson] = useState<ScheduleLesson | null>(null);
    const [subEditing, setSubEditing] = useState<Substitution | null>(null);
    const [subPanelOpen, setSubPanelOpen] = useState(false);
    const [subHighlight, setSubHighlight] = useState<Set<number>>(new Set());

    const terms = useMemo(() => {
        const t = (version as any)?.institutionType;
        if (t) return getTerms(t);
        try { return getTerms(localStorage.getItem('plantakt_institution_type') || 'school'); } catch { return getTerms('school'); }
    }, [version]);

    const isOddEven = version?.weekType === 'odd_even';
    const isSubMode = version?.type === 'substitution';

    const loadSchedule = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const [data, cd, td, sd, rd] = await Promise.all([
                scheduleService.getVersion(versionId), scheduleService.getClasses(),
                scheduleService.getTeachers(), scheduleService.getSubjects(), scheduleService.getRooms(),
            ]);
            setVersion(data.version); setLessons(data.lessons);
            setWorkloads(data.workloads); setConflicts(data.conflicts);
            setClasses(Array.isArray(cd) ? cd : cd.classes || []);
            setTeachers(Array.isArray(td) ? td : td.teachers || []);
            setSubjects(Array.isArray(sd) ? sd : sd.subjects || []);
            setRooms(Array.isArray(rd) ? rd : rd.rooms || []);
            setHistory([data.lessons]); setHistoryIndex(0);
        } catch (e: any) { setError(getErr(e, 'Ошибка загрузки')); }
        finally { setLoading(false); }
    }, [versionId]);

    useEffect(() => { loadSchedule(); }, [loadSchedule]);
    useEffect(() => { if (isOddEven && weekTab === 'all') setWeekTab('odd'); }, [isOddEven]);

    const loadSubs = useCallback(async () => {
        try { const data = await scheduleService.getSubstitutionsByVersion(versionId); setSubs(data); } catch { /* ignore */ }
    }, [versionId]);
    useEffect(() => { if (version?.type === 'substitution') loadSubs(); }, [version, loadSubs]);

    const saveToHistory = useCallback((nl: ScheduleLesson[]) => {
        setHistory(p => { const h = p.slice(0, historyIndex + 1); h.push(nl); return h; });
        setHistoryIndex(p => p + 1);
    }, [historyIndex]);

    const handleUndo = useCallback(() => { if (historyIndex > 0) { setHistoryIndex(p => p - 1); setLessons(history[historyIndex - 1]); } }, [history, historyIndex]);
    const handleRedo = useCallback(() => { if (historyIndex < history.length - 1) { setHistoryIndex(p => p + 1); setLessons(history[historyIndex + 1]); } }, [history, historyIndex]);

    const handleLessonMove = useCallback(async (lessonId: number, slot: any, roomId?: number) => {
        try { setSaving(true);
            const r = await scheduleService.moveLesson(lessonId, { dayOfWeek: slot.dayOfWeek, lessonNumber: slot.lessonNumber, weekType: slot.weekType, roomId });
            if (r.success && r.lesson) { setLessons(p => { const u = p.map(l => l.id === lessonId ? r.lesson! : l); saveToHistory(u); return u; });
                if (r.conflicts?.length) setConflicts(p => [...p.filter(c => !c.affectedLessons?.includes(lessonId)), ...r.conflicts!]);
            } else setError(r.errors?.map((e: any) => e.reason).join(', ') || 'Невозможно');
        } catch (e: any) { setError(getErr(e, 'Ошибка')); } finally { setSaving(false); }
    }, [saveToHistory]);

    const handleWorkloadDrop = useCallback(async (wId: number, slot: any, roomId?: number) => {
        try { setSaving(true);
            const wt = isOddEven && weekTab !== 'all' ? weekTab : slot.weekType;
            const r = await scheduleService.createLesson({ workloadId: wId, dayOfWeek: slot.dayOfWeek, lessonNumber: slot.lessonNumber, weekType: wt, roomId });
            if (r.success && r.lesson) { setSuggestSlots(null); setLessons(p => { const u = [...p, r.lesson!]; saveToHistory(u); return u; });
                setWorkloads(p => p.map(w => w.id === wId ? { ...w, placedHours: (w.placedHours || 0) + 1 } : w));
                if (r.conflicts?.length) setConflicts(p => [...p, ...r.conflicts!]);
            } else {
                setError(r.errors?.map((e: any) => e.reason).join(', ') || 'Невозможно поставить сюда');
                try { const av = await scheduleService.getAvailableSlots(wId); if (av?.slots?.length) setSuggestSlots({ workloadId: wId, slots: av.slots.slice(0, 6) }); } catch { /* ignore */ }
            }
        } catch (e: any) { setError(getErr(e, 'Ошибка')); } finally { setSaving(false); }
    }, [saveToHistory, isOddEven, weekTab]);

    const handleSlotDrop = useCallback((id: number, slot: any, roomId?: number) => {
        if (id > 0) handleLessonMove(id, slot, roomId);
        else if (slot.workloadId) handleWorkloadDrop(slot.workloadId, slot, roomId);
    }, [handleLessonMove, handleWorkloadDrop]);

    const handleLessonRemove = useCallback(async (lessonId: number) => {
        try { setSaving(true); const lesson = lessons.find(l => l.id === lessonId);
            await scheduleService.deleteLesson(lessonId);
            setLessons(p => { const u = p.filter(l => l.id !== lessonId); saveToHistory(u); return u; });
            if (lesson) setWorkloads(p => p.map(w => w.id === lesson.workloadId ? { ...w, placedHours: Math.max(0, (w.placedHours || 0) - 1) } : w));
            setConflicts(p => p.filter(c => !c.affectedLessons?.includes(lessonId)));
        } catch (e: any) { setError(getErr(e, 'Ошибка')); } finally { setSaving(false); }
    }, [lessons, saveToHistory]);

    const handleAutoGenerate = useCallback(async (opts: any) => {
        try { setIsGenerating(true); setAutoGenerateOpen(false);
            const r: any = await scheduleService.autoGenerate(versionId, opts); await loadSchedule();
            const parts: string[] = [];
            if (r.status === 'partial') parts.push(`Размещено ${r.statistics.placedWorkloads}, не удалось ${r.unplacedWorkloads?.length || 0}.`);
            else if (r.status === 'failed') parts.push('Не удалось составить расписание.');
            if (Array.isArray(r.warnings) && r.warnings.length) parts.push('Предупреждения: ' + r.warnings.slice(0, 3).join(' '));
            if (Array.isArray(r.unplacedDetails) && r.unplacedDetails.length) {
                const d = r.unplacedDetails.slice(0, 3).map((x: any) => `${x.subject || ''}${x.className ? ' (' + x.className + ')' : ''} — ${x.reason}`);
                parts.push('Причины: ' + d.join('; '));
            }
            setError(parts.length ? parts.join('  ') : null);
        } catch (e: any) { setError(getErr(e, 'Ошибка')); } finally { setIsGenerating(false); }
    }, [versionId, loadSchedule]);

    const handleAddWorkload = useCallback(async (data: any) => {
        try { await scheduleService.createWorkload(versionId, data); await loadSchedule(); }
        catch (e: any) { setError(getErr(e, 'Ошибка нагрузки')); }
    }, [versionId, loadSchedule]);

    const handleDeleteWorkload = useCallback(async (wId: number) => {
        try { await scheduleService.deleteWorkload(wId); setWorkloads(p => p.filter(w => w.id !== wId)); }
        catch (e: any) { setError(getErr(e, 'Ошибка')); }
    }, []);

    const substitutedLessonIds = useMemo(() => {
        const set = new Set<number>();
        subs.forEach(x => { if (x.date === subDate) set.add(x.lessonId); });
        return set;
    }, [subs, subDate]);

    const handleCellContextMenu = useCallback((_e: React.MouseEvent, _d: number, _n: number, lesson?: ScheduleLesson) => {
        if (!lesson) return;
        setSubLesson(lesson);
        setSubEditing(subs.find(x => x.lessonId === lesson.id && x.date === subDate) || null);
        setSubModalOpen(true);
    }, [subs, subDate]);

    const handleSubDelete = useCallback(async (id: number) => {
        try { await scheduleService.deleteSubstitution(id); setSubs(p => p.filter(x => x.id !== id)); }
        catch (e: any) { setError(getErr(e, 'Ошибка удаления')); }
    }, []);

    const handleSubExport = useCallback(async () => {
        try {
            const blob = await scheduleService.exportSubstitutions(versionId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `Zameny_${versionId}.xlsx`; a.click(); URL.revokeObjectURL(url);
        } catch (e: any) { setError(getErr(e, 'Ошибка экспорта')); }
    }, [versionId]);

    const hardConflicts = conflicts.filter(c => c.type === 'hard').length;
    const softConflicts = conflicts.filter(c => c.type === 'soft').length;
    const unplacedWorkloads = workloads.filter(w => (w.placedHours || 0) < w.hoursPerWeek).length;
    const totalHours = workloads.reduce((s, w) => s + w.hoursPerWeek, 0);
    const placedHours = workloads.reduce((s, w) => s + (w.placedHours || 0), 0);

    const weekFilteredLessons = useMemo(() => {
        if (!isOddEven || weekTab === 'all') return lessons;
        return lessons.filter(l => { if (l.weekType === WorkloadWeekType.BOTH) return true;
            if (weekTab === 'odd') return l.weekType === WorkloadWeekType.ODD;
            if (weekTab === 'even') return l.weekType === WorkloadWeekType.EVEN; return true; });
    }, [lessons, isOddEven, weekTab]);

    // В режиме замен показываем эффективные уроки на выбранную дату (подмена предмета/учителя/кабинета/позиции, «окно» скрывает урок)
    const displayLessons = useMemo(() => {
        if (!isSubMode) return weekFilteredLessons;
        const byLesson = new Map<number, Substitution>();
        subs.forEach((x) => { if ((x.date || '').slice(0, 10) === subDate) byLesson.set(x.lessonId, x); });
        if (byLesson.size === 0) return weekFilteredLessons;
        const out: ScheduleLesson[] = [];
        for (const l of weekFilteredLessons) {
            const sub = byLesson.get(l.id);
            if (!sub) { out.push(l); continue; }
            if (sub.isCancelled) continue;
            out.push({
                ...l,
                dayOfWeek: sub.newDayOfWeek ?? l.dayOfWeek,
                lessonNumber: sub.newLessonNumber ?? l.lessonNumber,
                weekType: (sub.newWeekType as any) ?? l.weekType,
                roomId: sub.newRoomId ?? l.roomId,
                room: (sub.newRoom as any) ?? l.room,
                workload: { ...(l.workload as any), subject: (sub.newSubject as any) ?? l.workload?.subject, teacher: (sub.newTeacher as any) ?? l.workload?.teacher },
            } as ScheduleLesson);
        }
        return out;
    }, [isSubMode, weekFilteredLessons, subs, subDate]);

    const highlightedLessonIds = useMemo(() => {
        const set = new Set<number>(); if (!searchQuery.trim()) return set;
        const q = searchQuery.trim().toLowerCase();
        weekFilteredLessons.forEach(l => { const w = l.workload;
            const texts = [w?.subject?.name, w?.subject?.shortName, w?.teacher?.fullName, w?.teacher?.shortName,
                w?.schoolClass?.name, w?.room?.name, l.room?.name, w?.group?.name].filter(Boolean).map(t => t!.toLowerCase());
            if (texts.some(t => t.includes(q))) set.add(l.id); }); return set;
    }, [searchQuery, weekFilteredLessons]);

    const currentEntities = useMemo(
        () => (viewMode === 'class' ? classes : viewMode === 'teacher' ? teachers : rooms) as any[],
        [viewMode, classes, teachers, rooms],
    );
    const labelOf = (e: any) => (viewMode === 'teacher' ? (e.shortName || e.fullName) : e.name);
    const toggleId = (id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    // При смене вкладки/данных оставляем валидный выбор, иначе выбираем первый
    useEffect(() => {
        const list: any[] = viewMode === 'class' ? classes : viewMode === 'teacher' ? teachers : rooms;
        setSelectedIds((prev) => {
            const valid = prev.filter((id) => list.some((e) => e.id === id));
            if (valid.length) return valid;
            return list.length ? [list[0].id] : [];
        });
    }, [viewMode, classes, teachers, rooms]);

    // Разбивка выбранных классов по сменам (для отображения смен)
    const shiftBreakdown = useMemo(() => {
        if (viewMode !== 'class') return null;
        const sel = classes.filter((c) => selectedIds.includes(c.id));
        return { s1: sel.filter((c) => ((c as any).shift || 1) === 1).length, s2: sel.filter((c) => (c as any).shift === 2).length };
    }, [viewMode, classes, selectedIds]);

    // Сетка для конкретного набора id (используется отдельно для каждой смены)
    const renderGrid = (ids: number[]) => (
        <ScheduleGrid
            lessons={displayLessons.filter((l) => { const w = l.workload;
                if (viewMode === 'class') return ids.includes((w?.schoolClass?.id ?? l.schoolClass?.id) as number);
                if (viewMode === 'teacher') return ids.includes((w?.teacher?.id ?? l.teacher?.id) as number);
                return ids.includes((l.roomId ?? l.room?.id ?? w?.room?.id) as number);
            })}
            viewMode={viewMode} selectedEntity={ids[0] ?? null} conflicts={showConflicts ? conflicts : []}
            weekType="single" maxLessons={version?.maxLessonsPerDay || 7}
            workingDays={version?.workingDays || 31}
            highlightedLessonIds={subHighlight.size ? subHighlight : highlightedLessonIds}
            substitutedLessonIds={isSubMode ? substitutedLessonIds : undefined}
            onCellContextMenu={isSubMode ? handleCellContextMenu : undefined}
            onLessonMove={handleSlotDrop} onLessonRemove={handleLessonRemove} onSlotClick={(s) => console.log('Slot:', s)} />
    );

    if (loading && !version) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}><CircularProgress /></Box>;

    return (
        <DndProvider backend={HTML5Backend}>
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
                    {onBack && <IconButton onClick={onBack} title="Назад" size="small"><ArrowBack /></IconButton>}
                    <Typography variant="h6" sx={{ flexGrow: 0, mr: 1 }} noWrap>{version?.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {hardConflicts > 0 && <Chip icon={<ErrorIcon />} label={`${hardConflicts} ош.`} color="error" size="small" onClick={() => setConflictPanelOpen(true)} />}
                        {softConflicts > 0 && <Chip icon={<Warning />} label={`${softConflicts} пред.`} color="warning" size="small" onClick={() => setConflictPanelOpen(true)} />}
                        {hardConflicts === 0 && softConflicts === 0 && <Chip icon={<CheckCircle />} label="OK" color="success" size="small" />}
                        <Chip label={`${placedHours}/${totalHours}`} variant="outlined" size="small" />
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    {showSearch ? (
                        <TextField size="small" placeholder={`Поиск: предмет, ${terms.teacherLabel.toLowerCase()}...`}
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus sx={{ width: 280 }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                                endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => { setSearchQuery(''); setShowSearch(false); }}><Close fontSize="small" /></IconButton></InputAdornment> }} />
                    ) : <IconButton onClick={() => setShowSearch(true)} title="Поиск"><Search /></IconButton>}
                    <IconButton onClick={handleUndo} disabled={historyIndex <= 0}><Undo /></IconButton>
                    <IconButton onClick={handleRedo} disabled={historyIndex >= history.length - 1}><Redo /></IconButton>
                    {!isSubMode && <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={() => setAutoGenerateOpen(true)} disabled={loading || isGenerating}>Авто</Button>}
                    {isSubMode && (
                        <>
                            <TextField type="date" size="small" value={subDate} onChange={(e) => setSubDate(e.target.value)} sx={{ width: 160 }} InputLabelProps={{ shrink: true }} />
                            <Button variant="contained" color="secondary" size="small" startIcon={<SwapHoriz />} onClick={() => setSubPanelOpen(true)}>Замены ({subs.length})</Button>
                        </>
                    )}
                    <Button variant="outlined" size="small" startIcon={<Download />} onClick={() => setExportOpen(true)}>Экспорт</Button>
                    <IconButton onClick={loadSchedule} disabled={loading}><Refresh /></IconButton>
                </Paper>
                {searchQuery.trim() && <Alert severity="info" sx={{ mx: 1, mt: 0.5 }} action={<Button size="small" onClick={() => { setSearchQuery(''); setShowSearch(false); }}>Сбросить</Button>}>Найдено: {highlightedLessonIds.size}</Alert>}
                {error && <Alert severity="error" onClose={() => { setError(null); setSuggestSlots(null); }} sx={{ m: 1 }}>{error}</Alert>}
                {suggestSlots && suggestSlots.slots.length > 0 && (
                    <Alert severity="info" sx={{ mx: 1, mb: 1 }} onClose={() => setSuggestSlots(null)}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2">Свободные слоты:</Typography>
                            {suggestSlots.slots.map((sl: any, i: number) => (
                                <Chip key={i} size="small" color="primary" variant="outlined" clickable
                                    label={`${DAYS_OF_WEEK.find(d => d.num === sl.dayOfWeek)?.short || sl.dayOfWeek}, ${sl.lessonNumber} ур.`}
                                    onClick={() => { handleWorkloadDrop(suggestSlots.workloadId, { dayOfWeek: sl.dayOfWeek, lessonNumber: sl.lessonNumber, weekType: WorkloadWeekType.BOTH }); setSuggestSlots(null); }} />
                            ))}
                        </Box>
                    </Alert>
                )}
                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                    <WorkloadPanel workloads={workloads} showUnplacedOnly={showUnplacedOnly}
                        onToggleFilter={() => setShowUnplacedOnly(p => !p)} onWorkloadDrop={handleWorkloadDrop}
                        onAddWorkload={handleAddWorkload} onDeleteWorkload={handleDeleteWorkload}
                        classes={classes} teachers={teachers} subjects={subjects} rooms={rooms} terms={terms} />
                    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                        <Tabs value={viewMode} onChange={(_, v) => { setViewMode(v); const list: any[] = v === 'class' ? classes : v === 'teacher' ? teachers : rooms; setSelectedIds(list[0] ? [list[0].id] : []); }} sx={{ mb: 1 }}>
                            <Tab value="class" label={terms.byClassTab} />
                            <Tab value="teacher" label={terms.byTeacherTab} />
                            <Tab value="room" label={terms.byRoomTab} />
                        </Tabs>
                        {isOddEven && (
                            <Paper sx={{ mb: 1, display: 'inline-flex', borderRadius: 2, overflow: 'hidden' }}>
                                <Tabs value={weekTab} onChange={(_, v) => setWeekTab(v)} TabIndicatorProps={{ sx: { height: 3 } }}>
                                    <Tab value="odd" label="I неделя (нечётная)" sx={{ bgcolor: weekTab === 'odd' ? '#e3f2fd' : 'transparent', minHeight: 36 }} />
                                    <Tab value="even" label="II неделя (чётная)" sx={{ bgcolor: weekTab === 'even' ? '#fce4ec' : 'transparent', minHeight: 36 }} />
                                </Tabs>
                            </Paper>
                        )}
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
                            <Button size="small" onClick={() => setSelectedIds(currentEntities.map((e) => e.id))}>Все</Button>
                            <Button size="small" onClick={() => setSelectedIds([])}>Очистить</Button>
                            {viewMode === 'class' ? (
                                [1, 2].map((sh) => {
                                    const group = classes.filter((c) => ((c as any).shift || 1) === sh);
                                    if (group.length === 0) return null;
                                    return (
                                        <Box key={sh} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', border: '1px dashed', borderColor: 'divider', borderRadius: 1, px: 0.75, py: 0.25 }}>
                                            <Chip size="small" color={sh === 2 ? 'secondary' : 'primary'} label={`${sh} смена`} onClick={() => setSelectedIds((prev) => Array.from(new Set([...prev, ...group.map((c) => c.id)])))} sx={{ cursor: 'pointer', fontWeight: 600 }} />
                                            {group.map((c) => <Chip key={c.id} label={c.name} size="small" variant={selectedIds.includes(c.id) ? 'filled' : 'outlined'} color={selectedIds.includes(c.id) ? (sh === 2 ? 'secondary' : 'primary') : 'default'} onClick={() => toggleId(c.id)} sx={{ cursor: 'pointer' }} />)}
                                        </Box>
                                    );
                                })
                            ) : (
                                currentEntities.map((e) => <Chip key={e.id} label={labelOf(e)} size="small" variant={selectedIds.includes(e.id) ? 'filled' : 'outlined'} color={selectedIds.includes(e.id) ? 'primary' : 'default'} onClick={() => toggleId(e.id)} sx={{ cursor: 'pointer' }} />)
                            )}
                        </Box>
                        {selectedIds.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 1 }}>Выберите один или несколько элементов выше, чтобы увидеть расписание.</Alert>
                        ) : viewMode === 'class' ? (
                            [1, 2].map((sh) => {
                                const ids = selectedIds.filter((id) => (((classes.find((c) => c.id === id) as any)?.shift) || 1) === sh);
                                if (!ids.length) return null;
                                const names = ids.map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ');
                                return (
                                    <Box key={sh} sx={{ mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                            <Chip size="small" color={sh === 2 ? 'secondary' : 'primary'} label={`${sh} смена`} sx={{ fontWeight: 600 }} />
                                            <Typography variant="body2" color="text.secondary">{names}</Typography>
                                        </Box>
                                        {renderGrid(ids)}
                                    </Box>
                                );
                            })
                        ) : (
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                    {selectedIds.length === 1
                                        ? labelOf(currentEntities.find((e) => e.id === selectedIds[0]) || {})
                                        : `Сводка: ${selectedIds.length} ${viewMode === 'teacher' ? 'учителей' : 'кабинетов'}`}
                                </Typography>
                                {renderGrid(selectedIds)}
                            </Box>
                        )}
                    </Box>
                </Box>
                <Drawer anchor="right" open={conflictPanelOpen} onClose={() => setConflictPanelOpen(false)}>
                    <ConflictPanel conflicts={conflicts} onConflictClick={(c) => console.log(c)} onClose={() => setConflictPanelOpen(false)} />
                </Drawer>
                <AutoGenerateModal open={autoGenerateOpen} onClose={() => setAutoGenerateOpen(false)} onGenerate={handleAutoGenerate} unplacedCount={unplacedWorkloads} isGenerating={isGenerating} />
                <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} versionId={versionId} />
                {isSubMode && (
                    <SubstitutionModal open={subModalOpen} onClose={() => setSubModalOpen(false)}
                        lesson={subLesson} date={subDate} isOddEven={isOddEven} subjects={subjects}
                        workingDays={version?.workingDays || 31} maxLessons={version?.maxLessonsPerDay || 7}
                        existing={subEditing} onSaved={loadSubs} />
                )}
                <Drawer anchor="right" open={subPanelOpen} onClose={() => setSubPanelOpen(false)}>
                    <Box sx={{ width: 400, p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ flexGrow: 1 }}>Замены</Typography>
                            <Button size="small" startIcon={<Download />} onClick={handleSubExport} disabled={!subs.length}>XLSX</Button>
                        </Box>
                        <Typography variant="caption" color="text.secondary">Клик по замене — подсветить урок. ПКМ по ячейке — создать/изменить.</Typography>
                        <List dense sx={{ mt: 1 }}>
                            {subs.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>Замен пока нет</Typography>}
                            {subs.map((x) => {
                                const w = x.lesson?.workload;
                                const orig = `${w?.schoolClass?.name || ''} · ${w?.subject?.name || ''}`.trim();
                                const to = x.isCancelled
                                    ? 'ОКНО'
                                    : ([x.newSubject?.name, x.newTeacher?.shortName, x.newRoom?.name].filter(Boolean).join(', ')
                                        || (x.newDayOfWeek ? 'перенос' : 'изменена'));
                                return (
                                    <ListItem key={x.id} disablePadding secondaryAction={
                                        <IconButton edge="end" size="small" onClick={() => handleSubDelete(x.id)}><Delete fontSize="small" /></IconButton>
                                    }>
                                        <ListItemButton onClick={() => setSubHighlight(new Set([x.lessonId]))}>
                                            <ListItemText primary={`${x.date} · ${orig}`} secondary={`→ ${to}${x.reason ? ' · ' + x.reason : ''}`} />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Box>
                </Drawer>
                {saving && <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', p: 1, borderRadius: 1, boxShadow: 2 }}><CircularProgress size={20} /><Typography variant="body2">Сохранение...</Typography></Box>}
            </Box>
        </DndProvider>
    );
};

export default ScheduleEditor;
