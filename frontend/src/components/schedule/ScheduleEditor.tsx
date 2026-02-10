import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Tabs,
    Tab,
    Chip,
    Alert,
    CircularProgress,
    Drawer,
} from '@mui/material';
import {
    Undo,
    Redo,
    PlayArrow,
    Warning,
    Error as ErrorIcon,
    CheckCircle,
    Download,
    Refresh,
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
    ScheduleVersion,
    ScheduleLesson,
    Workload,
    ScheduleConflict,
} from '../../types/schedule';

interface ScheduleEditorProps {
    versionId: number;
}

type ViewMode = 'class' | 'teacher' | 'room';

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ versionId }) => {
    // Состояния данных
    const [version, setVersion] = useState<ScheduleVersion | null>(null);
    const [lessons, setLessons] = useState<ScheduleLesson[]>([]);
    const [workloads, setWorkloads] = useState<Workload[]>([]);
    const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
    
    // Состояния UI
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('class');
    const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
    const [showUnplacedOnly, setShowUnplacedOnly] = useState(false);
    const [showConflicts, setShowConflicts] = useState(true);
    
    // Модальные окна
    const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [conflictPanelOpen, setConflictPanelOpen] = useState(false);
    
    // История для undo/redo
    const [history, setHistory] = useState<ScheduleLesson[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Загрузка данных
    const loadSchedule = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await scheduleService.getVersion(versionId);
            
            setVersion(data.version);
            setLessons(data.lessons);
            setWorkloads(data.workloads);
            setConflicts(data.conflicts);

            // Инициализируем историю
            setHistory([data.lessons]);
            setHistoryIndex(0);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка загрузки расписания');
        } finally {
            setLoading(false);
        }
    }, [versionId]);

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    // Сохранение в историю
    const saveToHistory = useCallback((newLessons: ScheduleLesson[]) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(newLessons);
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setLessons(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setLessons(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    // Перемещение урока (drag & drop)
    const handleLessonMove = useCallback(async (
        lessonId: number,
        targetSlot: { dayOfWeek: number; lessonNumber: number; weekType?: string },
        roomId?: number,
    ) => {
        try {
            setSaving(true);

            const result = await scheduleService.moveLesson(lessonId, {
                dayOfWeek: targetSlot.dayOfWeek,
                lessonNumber: targetSlot.lessonNumber,
                weekType: targetSlot.weekType,
                roomId,
            });

            if (result.success && result.lesson) {
                const movedLesson = result.lesson;
                setLessons(prev => {
                    const updated = prev.map(l => 
                        l.id === lessonId ? movedLesson : l
                    );
                    saveToHistory(updated);
                    return updated;
                });

                if (result.conflicts && result.conflicts.length > 0) {
                    const newConflicts = result.conflicts;
                    setConflicts(prev => {
                        const filtered = prev.filter(c => !c.affectedLessons?.includes(lessonId));
                        return [...filtered, ...newConflicts];
                    });
                }
            } else {
                setError(result.errors?.map((e: any) => e.reason).join(', ') || 'Невозможно разместить урок');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка перемещения урока');
        } finally {
            setSaving(false);
        }
    }, [saveToHistory]);

    // Добавление урока из нагрузки
    const handleWorkloadDrop = useCallback(async (
        workloadId: number,
        targetSlot: { dayOfWeek: number; lessonNumber: number; weekType?: string },
        roomId?: number,
    ) => {
        try {
            setSaving(true);

            const result = await scheduleService.createLesson({
                workloadId,
                dayOfWeek: targetSlot.dayOfWeek,
                lessonNumber: targetSlot.lessonNumber,
                weekType: targetSlot.weekType,
                roomId,
            });

            if (result.success && result.lesson) {
                const newLesson = result.lesson;
                setLessons(prev => {
                    const updated = [...prev, newLesson];
                    saveToHistory(updated);
                    return updated;
                });

                setWorkloads(prev => prev.map(w => {
                    if (w.id === workloadId) {
                        return { ...w, placedHours: (w.placedHours || 0) + 1 };
                    }
                    return w;
                }));

                if (result.conflicts && result.conflicts.length > 0) {
                    const newConflicts = result.conflicts;
                    setConflicts(prev => [...prev, ...newConflicts]);
                }
            } else {
                setError(result.errors?.map((e: any) => e.reason).join(', ') || 'Невозможно разместить урок');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка добавления урока');
        } finally {
            setSaving(false);
        }
    }, [saveToHistory]);

    // Удаление урока
    const handleLessonRemove = useCallback(async (lessonId: number) => {
        try {
            setSaving(true);

            const lesson = lessons.find(l => l.id === lessonId);
            await scheduleService.deleteLesson(lessonId);

            setLessons(prev => {
                const updated = prev.filter(l => l.id !== lessonId);
                saveToHistory(updated);
                return updated;
            });

            if (lesson) {
                setWorkloads(prev => prev.map(w => {
                    if (w.id === lesson.workloadId) {
                        return { ...w, placedHours: Math.max(0, (w.placedHours || 0) - 1) };
                    }
                    return w;
                }));
            }

            setConflicts(prev => prev.filter(c => !c.affectedLessons?.includes(lessonId)));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка удаления урока');
        } finally {
            setSaving(false);
        }
    }, [lessons, saveToHistory]);

    // Автоматическое составление
    const handleAutoGenerate = useCallback(async (options: any) => {
        try {
            setLoading(true);
            setAutoGenerateOpen(false);

            const result = await scheduleService.autoGenerate(versionId, options);

            await loadSchedule();

            if (result.status === 'completed') {
                setError(null);
            } else if (result.status === 'partial') {
                setError(`Размещено ${result.statistics.placedWorkloads} уроков. ${result.unplacedWorkloads?.length || 0} нагрузок не удалось разместить.`);
            } else {
                setError('Не удалось составить расписание. Проверьте ограничения и нагрузку.');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ошибка автоматического составления');
        } finally {
            setLoading(false);
        }
    }, [versionId, loadSchedule]);

    // Подсчёт статистики
    const hardConflicts = conflicts.filter(c => c.type === 'hard').length;
    const softConflicts = conflicts.filter(c => c.type === 'soft').length;
    const unplacedWorkloads = workloads.filter(w => (w.placedHours || 0) < w.hoursPerWeek).length;
    const totalHours = workloads.reduce((sum, w) => sum + w.hoursPerWeek, 0);
    const placedHours = workloads.reduce((sum, w) => sum + (w.placedHours || 0), 0);

    if (loading && !version) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Toolbar */}
                <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <Typography variant="h6" sx={{ flexGrow: 0, mr: 2 }}>
                        {version?.name}
                    </Typography>

                    {/* Статусы */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {hardConflicts > 0 && (
                            <Chip
                                icon={<ErrorIcon />}
                                label={`${hardConflicts} ошибок`}
                                color="error"
                                size="small"
                                onClick={() => setConflictPanelOpen(true)}
                            />
                        )}
                        {softConflicts > 0 && (
                            <Chip
                                icon={<Warning />}
                                label={`${softConflicts} предупреждений`}
                                color="warning"
                                size="small"
                                onClick={() => setConflictPanelOpen(true)}
                            />
                        )}
                        {hardConflicts === 0 && softConflicts === 0 && (
                            <Chip
                                icon={<CheckCircle />}
                                label="Нет конфликтов"
                                color="success"
                                size="small"
                            />
                        )}
                        <Chip
                            label={`${placedHours}/${totalHours} часов`}
                            variant="outlined"
                            size="small"
                        />
                    </Box>

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Действия */}
                    <IconButton
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        title="Отменить (Ctrl+Z)"
                    >
                        <Undo />
                    </IconButton>
                    <IconButton
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        title="Повторить (Ctrl+Y)"
                    >
                        <Redo />
                    </IconButton>

                    <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={() => setAutoGenerateOpen(true)}
                        disabled={loading}
                    >
                        Авто
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={() => setExportOpen(true)}
                    >
                        Экспорт
                    </Button>

                    <IconButton onClick={loadSchedule} disabled={loading}>
                        <Refresh />
                    </IconButton>
                </Paper>

                {/* Ошибка */}
                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1 }}>
                        {error}
                    </Alert>
                )}

                {/* Основной контент */}
                <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                    {/* Панель нагрузки (левая) */}
                    <WorkloadPanel
                        workloads={workloads}
                        showUnplacedOnly={showUnplacedOnly}
                        onToggleFilter={() => setShowUnplacedOnly(prev => !prev)}
                        onWorkloadDrop={handleWorkloadDrop}
                    />

                    {/* Сетка расписания (центр) */}
                    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                        {/* Переключатель вида */}
                        <Tabs
                            value={viewMode}
                            onChange={(_, v) => setViewMode(v)}
                            sx={{ mb: 1 }}
                        >
                            <Tab value="class" label="По классам" />
                            <Tab value="teacher" label="По учителям" />
                            <Tab value="room" label="По кабинетам" />
                        </Tabs>

                        <ScheduleGrid
                            lessons={lessons}
                            viewMode={viewMode}
                            selectedEntity={selectedEntity}
                            conflicts={showConflicts ? conflicts : []}
                            weekType={version?.weekType || 'single'}
                            maxLessons={version?.maxLessonsPerDay || 7}
                            onLessonMove={handleLessonMove}
                            onLessonRemove={handleLessonRemove}
                            onSlotClick={(slot) => console.log('Slot clicked:', slot)}
                        />
                    </Box>
                </Box>

                {/* Панель конфликтов (правая, drawer) */}
                <Drawer
                    anchor="right"
                    open={conflictPanelOpen}
                    onClose={() => setConflictPanelOpen(false)}
                >
                    <ConflictPanel
                        conflicts={conflicts}
                        onConflictClick={(conflict) => {
                            console.log('Conflict clicked:', conflict);
                        }}
                        onClose={() => setConflictPanelOpen(false)}
                    />
                </Drawer>

                {/* Модальные окна */}
                <AutoGenerateModal
                    open={autoGenerateOpen}
                    onClose={() => setAutoGenerateOpen(false)}
                    onGenerate={handleAutoGenerate}
                    unplacedCount={unplacedWorkloads}
                />

                <ExportModal
                    open={exportOpen}
                    onClose={() => setExportOpen(false)}
                    versionId={versionId}
                />

                {/* Индикатор сохранения */}
                {saving && (
                    <Box
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: 'background.paper',
                            p: 1,
                            borderRadius: 1,
                            boxShadow: 2,
                        }}
                    >
                        <CircularProgress size={20} />
                        <Typography variant="body2">Сохранение...</Typography>
                    </Box>
                )}
            </Box>
        </DndProvider>
    );
};

export default ScheduleEditor;
