import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    InputAdornment,
    Chip,
    IconButton,
    Collapse,
    FormControlLabel,
    Switch,
    Checkbox,
    Badge,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
} from '@mui/material';
import {
    Search,
    ExpandMore,
    ExpandLess,
    DragIndicator,
    Add,
    Delete,
} from '@mui/icons-material';
import { useDrag, DragSourceMonitor } from 'react-dnd';
import { Workload, SchoolClass, Teacher, Subject, Room, ClassGroup } from '../../types/schedule';
import { getTerms, InstitutionTerms } from '../../utils/institutionTypes';

interface WorkloadPanelProps {
    workloads: Workload[];
    showUnplacedOnly: boolean;
    onToggleFilter: () => void;
    onWorkloadDrop: (workloadId: number, targetSlot: any, roomId?: number) => void;
    onAddWorkload?: (data: {
        classId: number; subjectId: number; teacherId: number;
        roomId?: number; groupId?: number; hoursPerWeek: number;
        allowDoubleLessons?: boolean;
        additionalClassIds?: number[];
        additionalTeacherIds?: number[];
    }) => Promise<void>;
    onDeleteWorkload?: (workloadId: number) => Promise<void>;
    classes?: SchoolClass[];
    teachers?: Teacher[];
    subjects?: Subject[];
    rooms?: Room[];
    terms?: InstitutionTerms;
}

// Компонент draggable элемента нагрузки
interface WorkloadItemProps {
    workload: Workload;
    onDelete?: (id: number) => void;
}

const WorkloadItem: React.FC<WorkloadItemProps> = ({ workload, onDelete }) => {
    const ref = useRef<HTMLDivElement>(null);
    const remainingHours = workload.hoursPerWeek - (workload.placedHours || 0);

    const [{ isDragging }, drag] = useDrag({
        type: 'WORKLOAD',
        item: { type: 'WORKLOAD', id: workload.id },
        canDrag: remainingHours > 0,
        collect: (monitor: DragSourceMonitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    useEffect(() => {
        if (ref.current) {
            drag(ref.current);
        }
    }, [drag]);

    const subject = workload.subject;
    const teacher = workload.teacher;
    const schoolClass = workload.schoolClass;
    const group = workload.group;

    const bgColor = subject?.color || '#E0E0E0';

    return (
        <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
            <Paper
                elevation={isDragging ? 3 : 1}
                sx={{
                    p: 1,
                    mb: 1,
                    bgcolor: remainingHours > 0 ? bgColor : 'grey.200',
                    opacity: remainingHours > 0 ? 1 : 0.6,
                    cursor: remainingHours > 0 ? 'grab' : 'default',
                    borderLeft: remainingHours > 0 ? `4px solid ${subject?.color || '#1976d2'}` : 'none',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {remainingHours > 0 && (
                        <DragIndicator sx={{ opacity: 0.5, mt: 0.5 }} fontSize="small" />
                    )}

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {subject?.name || 'Предмет'}
                        </Typography>

                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {teacher?.shortName || teacher?.fullName}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                                label={schoolClass?.name}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            {group && (
                                <Chip
                                    label={group.name}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                            )}
                        </Box>
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary">
                            {workload.placedHours || 0}/{workload.hoursPerWeek}
                        </Typography>
                        {remainingHours > 0 && (
                            <Badge
                                badgeContent={remainingHours}
                                color="primary"
                                sx={{ ml: 1 }}
                            />
                        )}
                        {onDelete && (workload.placedHours || 0) === 0 && (
                            <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); onDelete(workload.id); }}
                                sx={{ ml: 0.5, p: 0.25 }}
                                color="error"
                            >
                                <Delete sx={{ fontSize: 14 }} />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Paper>
        </div>
    );
};

const WorkloadPanel: React.FC<WorkloadPanelProps> = ({
    workloads,
    showUnplacedOnly,
    onToggleFilter,
    onAddWorkload,
    onDeleteWorkload,
    classes = [],
    teachers = [],
    subjects = [],
    rooms = [],
    terms = getTerms('school'),
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set());
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [addLoading, setAddLoading] = useState(false);
    const [newWorkload, setNewWorkload] = useState({
        classId: 0,
        groupId: 0,  // FIX #8: добавлена подгруппа
        subjectId: 0,
        teacherId: 0,
        roomId: 0,
        hoursPerWeek: 2,
        allowDoubleLessons: false,
        additionalClassIds: [] as number[],
        additionalTeacherIds: [] as number[],
    });

    // FIX #8: Подгруппы выбранного класса
    const selectedClassGroups: ClassGroup[] = useMemo(() => {
        if (!newWorkload.classId) return [];
        const cls = classes.find(c => c.id === newWorkload.classId);
        return cls?.groups || [];
    }, [newWorkload.classId, classes]);

    const handleAddWorkload = async () => {
        if (!onAddWorkload || !newWorkload.classId || !newWorkload.subjectId || !newWorkload.teacherId) return;
        try {
            setAddLoading(true);
            await onAddWorkload({
                classId: newWorkload.classId,
                subjectId: newWorkload.subjectId,
                teacherId: newWorkload.teacherId,
                roomId: newWorkload.roomId || undefined,
                groupId: newWorkload.groupId || undefined,  // FIX #8
                hoursPerWeek: newWorkload.hoursPerWeek,
                allowDoubleLessons: newWorkload.allowDoubleLessons,
                additionalClassIds: newWorkload.additionalClassIds.length ? newWorkload.additionalClassIds : undefined,
                additionalTeacherIds: newWorkload.additionalTeacherIds.length ? newWorkload.additionalTeacherIds : undefined,
            });
            setAddDialogOpen(false);
            setNewWorkload({ classId: 0, groupId: 0, subjectId: 0, teacherId: 0, roomId: 0, hoursPerWeek: 2, allowDoubleLessons: false, additionalClassIds: [], additionalTeacherIds: [] });
        } catch {
            // error handled by parent
        } finally {
            setAddLoading(false);
        }
    };

    const handleDeleteWorkload = async (workloadId: number) => {
        if (!onDeleteWorkload) return;
        if (!window.confirm('Удалить нагрузку?')) return;
        await onDeleteWorkload(workloadId);
    };

    // Группируем нагрузки по классам
    const groupedWorkloads = useMemo(() => {
        const groups = new Map<number, { schoolClass: SchoolClass | undefined; workloads: Workload[] }>();

        workloads.forEach((workload) => {
            const classId = workload.classId;
            const schoolClass = workload.schoolClass;

            if (!groups.has(classId)) {
                groups.set(classId, { schoolClass, workloads: [] });
            }
            groups.get(classId)!.workloads.push(workload);
        });

        return Array.from(groups.values()).sort((a, b) => {
            const gradeA = a.schoolClass?.gradeLevel || 0;
            const gradeB = b.schoolClass?.gradeLevel || 0;
            if (gradeA !== gradeB) return gradeA - gradeB;
            return (a.schoolClass?.name || '').localeCompare(b.schoolClass?.name || '');
        });
    }, [workloads]);

    // Фильтрация
    const filteredGroups = useMemo(() => {
        return groupedWorkloads
            .map((group) => {
                let filteredWorkloads = group.workloads;

                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    filteredWorkloads = filteredWorkloads.filter(
                        (w) =>
                            w.subject?.name.toLowerCase().includes(query) ||
                            w.teacher?.fullName.toLowerCase().includes(query) ||
                            w.teacher?.shortName.toLowerCase().includes(query) ||
                            w.group?.name.toLowerCase().includes(query)
                    );
                }

                if (showUnplacedOnly) {
                    filteredWorkloads = filteredWorkloads.filter(
                        (w) => (w.placedHours || 0) < w.hoursPerWeek
                    );
                }

                return { ...group, workloads: filteredWorkloads };
            })
            .filter((group) => group.workloads.length > 0);
    }, [groupedWorkloads, searchQuery, showUnplacedOnly]);

    const totalUnplaced = useMemo(() => {
        return workloads.reduce((sum, w) => sum + Math.max(0, w.hoursPerWeek - (w.placedHours || 0)), 0);
    }, [workloads]);

    const toggleClassExpanded = (classId: number) => {
        setExpandedClasses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(classId)) newSet.delete(classId);
            else newSet.add(classId);
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedClasses(new Set(groupedWorkloads.map((g) => g.schoolClass?.id).filter((id): id is number => id !== undefined)));
    };

    const collapseAll = () => { setExpandedClasses(new Set()); };

    return (
        <Paper sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
            {/* Заголовок */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Нагрузка</Typography>
                    {onAddWorkload && (
                        <IconButton size="small" color="primary" onClick={() => setAddDialogOpen(true)} title="Добавить нагрузку">
                            <Add />
                        </IconButton>
                    )}
                </Box>

                <TextField size="small" fullWidth placeholder="Поиск..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                    sx={{ mb: 1 }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormControlLabel
                        control={<Switch size="small" checked={showUnplacedOnly} onChange={onToggleFilter} />}
                        label={<Typography variant="caption">Только нераспределённые</Typography>}
                    />
                    <Chip label={`${totalUnplaced} ч.`} size="small" color={totalUnplaced > 0 ? 'warning' : 'success'} />
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip label="Развернуть все" size="small" variant="outlined" onClick={expandAll} sx={{ fontSize: '0.7rem' }} />
                    <Chip label="Свернуть все" size="small" variant="outlined" onClick={collapseAll} sx={{ fontSize: '0.7rem' }} />
                </Box>
            </Box>

            {/* Список нагрузок */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                {filteredGroups.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                        {searchQuery || showUnplacedOnly ? 'Ничего не найдено' : 'Нет нагрузки'}
                    </Typography>
                ) : (
                    filteredGroups.map((group) => {
                        const classId = group.schoolClass?.id || 0;
                        const isExpanded = expandedClasses.has(classId);
                        const unplacedCount = group.workloads.filter((w) => (w.placedHours || 0) < w.hoursPerWeek).length;

                        return (
                            <Box key={classId} sx={{ mb: 1 }}>
                                <Paper
                                    sx={{ p: 1, display: 'flex', alignItems: 'center', cursor: 'pointer', bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
                                    onClick={() => toggleClassExpanded(classId)}
                                >
                                    <IconButton size="small">{isExpanded ? <ExpandLess /> : <ExpandMore />}</IconButton>
                                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{group.schoolClass?.name}</Typography>
                                    {unplacedCount > 0 && <Chip label={unplacedCount} size="small" color="warning" sx={{ height: 20 }} />}
                                </Paper>

                                <Collapse in={isExpanded}>
                                    <Box sx={{ pl: 1, pt: 1 }}>
                                        {group.workloads.map((workload) => (
                                            <WorkloadItem key={workload.id} workload={workload} onDelete={onDeleteWorkload ? handleDeleteWorkload : undefined} />
                                        ))}
                                    </Box>
                                </Collapse>
                            </Box>
                        );
                    })
                )}
            </Box>

            {/* FIX #8: Диалог добавления нагрузки с подгруппой */}
            <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Добавить нагрузку</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                        <InputLabel>{terms.classLabel} *</InputLabel>
                        <Select value={newWorkload.classId || ''} label={`${terms.classLabel} *`} onChange={(e) => setNewWorkload({ ...newWorkload, classId: Number(e.target.value), groupId: 0 })}>
                            {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    {/* FIX #8: Подгруппа (показывается только если у выбранного класса есть группы) */}
                    {selectedClassGroups.length > 0 && (
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Подгруппа</InputLabel>
                            <Select value={newWorkload.groupId || ''} label="Подгруппа" onChange={(e) => setNewWorkload({ ...newWorkload, groupId: Number(e.target.value) })}>
                                <MenuItem value={0}>— {terms.classLabel} целиком —</MenuItem>
                                {selectedClassGroups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}{g.studentsCount ? ` (${g.studentsCount} уч.)` : ''}</MenuItem>)}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Предмет *</InputLabel>
                        <Select value={newWorkload.subjectId || ''} label="Предмет *" onChange={(e) => setNewWorkload({ ...newWorkload, subjectId: Number(e.target.value) })}>
                            {subjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>{terms.teacherLabel} *</InputLabel>
                        <Select value={newWorkload.teacherId || ''} label={`${terms.teacherLabel} *`} onChange={(e) => setNewWorkload({ ...newWorkload, teacherId: Number(e.target.value) })}>
                            {teachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.fullName}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>{terms.roomLabel}</InputLabel>
                        <Select value={newWorkload.roomId || ''} label={terms.roomLabel} onChange={(e) => setNewWorkload({ ...newWorkload, roomId: Number(e.target.value) })}>
                            <MenuItem value={0}>— Не указан —</MenuItem>
                            {rooms.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <TextField fullWidth label="Часов в неделю" type="number" value={newWorkload.hoursPerWeek}
                        onChange={(e) => setNewWorkload({ ...newWorkload, hoursPerWeek: Math.max(1, Number(e.target.value)) })}
                        inputProps={{ min: 1, max: 20 }}
                    />

                    <FormControlLabel
                        sx={{ mt: 1, alignItems: 'flex-start' }}
                        control={
                            <Checkbox
                                checked={newWorkload.allowDoubleLessons}
                                onChange={(e) => setNewWorkload({ ...newWorkload, allowDoubleLessons: e.target.checked })}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2">Разрешить сдвоенные уроки (пары)</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Автосоставитель сможет ставить два урока подряд в один день.
                                    Без галочки часы распределяются по разным дням.
                                </Typography>
                            </Box>
                        }
                    />

                    {/* Объединённый урок / поток: несколько классов на одном занятии */}
                    <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
                        <InputLabel>Объединить с классами (поток/лекция)</InputLabel>
                        <Select
                            multiple
                            value={newWorkload.additionalClassIds}
                            label="Объединить с классами (поток/лекция)"
                            onChange={(e) => setNewWorkload({ ...newWorkload, additionalClassIds: (e.target.value as number[]) })}
                            renderValue={(sel) => (sel as number[]).map((id) => classes.find((c) => c.id === id)?.name || id).join(', ')}
                        >
                            {classes.filter((c) => c.id !== newWorkload.classId).map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Совместное преподавание: несколько преподавателей на одном занятии */}
                    <FormControl fullWidth sx={{ mb: 1 }}>
                        <InputLabel>Совместно с преподавателями</InputLabel>
                        <Select
                            multiple
                            value={newWorkload.additionalTeacherIds}
                            label="Совместно с преподавателями"
                            onChange={(e) => setNewWorkload({ ...newWorkload, additionalTeacherIds: (e.target.value as number[]) })}
                            renderValue={(sel) => (sel as number[]).map((id) => teachers.find((t) => t.id === id)?.shortName || teachers.find((t) => t.id === id)?.fullName || id).join(', ')}
                        >
                            {teachers.filter((t) => t.id !== newWorkload.teacherId).map((t) => (
                                <MenuItem key={t.id} value={t.id}>{t.fullName}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary">
                        Объединённый урок займёт все выбранные классы и преподавателей в одном слоте (лекция-поток, совместное занятие).
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleAddWorkload}
                        disabled={!newWorkload.classId || !newWorkload.subjectId || !newWorkload.teacherId || addLoading}
                        startIcon={addLoading ? <CircularProgress size={16} /> : undefined}
                    >
                        Добавить
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
};

export default WorkloadPanel;
