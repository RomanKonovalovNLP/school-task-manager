import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, Tabs, Tab, Chip,
    Alert, CircularProgress, Drawer, TextField, InputAdornment,
} from '@mui/material';
import {
    Undo, Redo, PlayArrow, Warning, Error as ErrorIcon,
    CheckCircle, Download, Refresh, ArrowBack, Search, Close,
} from '@mui/icons-material';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ScheduleGrid from './ScheduleGrid';
import WorkloadPanel from './WorkloadPanel';
import ConflictPanel from './ConflictPanel';
import AutoGenerateModal from './AutoGenerateModal';
import ExportModal from './ExportModal';
import { scheduleService } from '../../services/schedule.service';
import {
    ScheduleVersion, ScheduleLesson, Workload, ScheduleConflict,
    SchoolClass, Teacher, Subject, Room, WorkloadWeekType,
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
    const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
    const [showUnplacedOnly, setShowUnplacedOnly] = useState(false);
    const [showConflicts, setShowConflicts] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [weekTab, setWeekTab] = useState<'all' | 'odd' | 'even'>('all');
    const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [conflictPanelOpen, setConflictPanelOpen] = useState(false);
    const [history, setHistory] = useState<ScheduleLesson[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const terms = useMemo(() => {
        const t = (version as any)?.institutionType;
        if (t) return getTerms(t);
        try { return getTerms(localStorage.getItem('plantakt_institution_type') || 'school'); } catch { return getTerms('school'); }
    }, [version]);

    const isOddEven = version?.weekType === 'odd_even';

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
            if (r.success && r.lesson) { setLessons(p => { const u = [...p, r.lesson!]; saveToHistory(u); return u; });
                setWorkloads(p => p.map(w => w.id === wId ? { ...w, placedHours: (w.placedHours || 0) + 1 } : w));
                if (r.conflicts?.length) setConflicts(p => [...p, ...r.conflicts!]);
            } else setError(r.errors?.map((e: any) => e.reason).join(', ') || 'Невозможно');
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
            const r = await scheduleService.autoGenerate(versionId, opts); await loadSchedule();
            if (r.status === 'completed') setError(null);
            else if (r.status === 'partial') setError(`Размещено ${r.statistics.placedWorkloads}. ${r.unplacedWorkloads?.length || 0} не удалось.`);
            else setError('Не удалось составить расписание.');
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

    const highlightedLessonIds = useMemo(() => {
        const set = new Set<number>(); if (!searchQuery.trim()) return set;
        const q = searchQuery.trim().toLowerCase();
        weekFilteredLessons.forEach(l => { const w = l.workload;
            const texts = [w?.subject?.name, w?.subject?.shortName, w?.teacher?.fullName, w?.teacher?.shortName,
                w?.schoolClass?.name, w?.room?.name, l.room?.name, w?.group?.name].filter(Boolean).map(t => t!.toLowerCase());
            if (texts.some(t => t.includes(q))) set.add(l.id); }); return set;
    }, [searchQuery, weekFilteredLessons]);

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
                    <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={() => setAutoGenerateOpen(true)} disabled={loading || isGenerating}>Авто</Button>
                    <Button variant="outlined" size="small" startIcon={<Download />} onClick={() => setExportOpen(true)}>Экспорт</Button>
                    <IconButton onClick={loadSchedule} disabled={loading}><Refresh /></IconButton>
                </Paper>
                {searchQuery.trim() && <Alert severity="info" sx={{ mx: 1, mt: 0.5 }} action={<Button size="small" onClick={() => { setSearchQuery(''); setShowSearch(false); }}>Сбросить</Button>}>Найдено: {highlightedLessonIds.size}</Alert>}
                {error && <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1 }}>{error}</Alert>}
                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                    <WorkloadPanel workloads={workloads} showUnplacedOnly={showUnplacedOnly}
                        onToggleFilter={() => setShowUnplacedOnly(p => !p)} onWorkloadDrop={handleWorkloadDrop}
                        onAddWorkload={handleAddWorkload} onDeleteWorkload={handleDeleteWorkload}
                        classes={classes} teachers={teachers} subjects={subjects} rooms={rooms} />
                    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                        <Tabs value={viewMode} onChange={(_, v) => { setViewMode(v); setSelectedEntity(null); }} sx={{ mb: 1 }}>
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
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                            {viewMode === 'class' && classes.map(c => <Chip key={c.id} label={c.name} size="small" variant={selectedEntity === c.id ? 'filled' : 'outlined'} color={selectedEntity === c.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === c.id ? null : c.id)} sx={{ cursor: 'pointer' }} />)}
                            {viewMode === 'teacher' && teachers.map(t => <Chip key={t.id} label={t.shortName || t.fullName} size="small" variant={selectedEntity === t.id ? 'filled' : 'outlined'} color={selectedEntity === t.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === t.id ? null : t.id)} sx={{ cursor: 'pointer' }} />)}
                            {viewMode === 'room' && rooms.map(r => <Chip key={r.id} label={r.name} size="small" variant={selectedEntity === r.id ? 'filled' : 'outlined'} color={selectedEntity === r.id ? 'primary' : 'default'} onClick={() => setSelectedEntity(selectedEntity === r.id ? null : r.id)} sx={{ cursor: 'pointer' }} />)}
                        </Box>
                        <ScheduleGrid
                            lessons={selectedEntity ? weekFilteredLessons.filter(l => { const w = l.workload;
                                if (viewMode === 'class') return w?.schoolClass?.id === selectedEntity || l.schoolClass?.id === selectedEntity;
                                if (viewMode === 'teacher') return w?.teacher?.id === selectedEntity || l.teacher?.id === selectedEntity;
                                if (viewMode === 'room') return l.roomId === selectedEntity || l.room?.id === selectedEntity || w?.room?.id === selectedEntity;
                                return true; }) : weekFilteredLessons}
                            viewMode={viewMode} selectedEntity={selectedEntity} conflicts={showConflicts ? conflicts : []}
                            weekType="single" maxLessons={version?.maxLessonsPerDay || 7}
                            workingDays={version?.workingDays || 31} highlightedLessonIds={highlightedLessonIds}
                            onLessonMove={handleSlotDrop} onLessonRemove={handleLessonRemove} onSlotClick={(s) => console.log('Slot:', s)} />
                    </Box>
                </Box>
                <Drawer anchor="right" open={conflictPanelOpen} onClose={() => setConflictPanelOpen(false)}>
                    <ConflictPanel conflicts={conflicts} onConflictClick={(c) => console.log(c)} onClose={() => setConflictPanelOpen(false)} />
                </Drawer>
                <AutoGenerateModal open={autoGenerateOpen} onClose={() => setAutoGenerateOpen(false)} onGenerate={handleAutoGenerate} unplacedCount={unplacedWorkloads} isGenerating={isGenerating} />
                <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} versionId={versionId} />
                {saving && <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'background.paper', p: 1, borderRadius: 1, boxShadow: 2 }}><CircularProgress size={20} /><Typography variant="body2">Сохранение...</Typography></Box>}
            </Box>
        </DndProvider>
    );
};

export default ScheduleEditor;
