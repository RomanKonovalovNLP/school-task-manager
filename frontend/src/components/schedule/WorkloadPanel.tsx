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
    Badge,
} from '@mui/material';
import {
    Search,
    ExpandMore,
    ExpandLess,
    DragIndicator,
} from '@mui/icons-material';
import { useDrag, DragSourceMonitor } from 'react-dnd';
import { Workload, SchoolClass } from '../../types/schedule';

interface WorkloadPanelProps {
    workloads: Workload[];
    showUnplacedOnly: boolean;
    onToggleFilter: () => void;
    onWorkloadDrop: (workloadId: number, targetSlot: any, roomId?: number) => void;
}

// Компонент draggable элемента нагрузки
interface WorkloadItemProps {
    workload: Workload;
}

const WorkloadItem: React.FC<WorkloadItemProps> = ({ workload }) => {
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
                            sx={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {subject?.name || 'Предмет'}
                        </Typography>

                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
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
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set());

    // Группируем нагрузки по классам
    const groupedWorkloads = useMemo(() => {
        const groups = new Map<number, { schoolClass: SchoolClass | undefined; workloads: Workload[] }>();

        workloads.forEach((workload) => {
            const classId = workload.classId;
            const schoolClass = workload.schoolClass;

            if (!groups.has(classId)) {
                groups.set(classId, {
                    schoolClass: schoolClass,
                    workloads: [],
                });
            }
            groups.get(classId)!.workloads.push(workload);
        });

        // Сортируем по имени класса
        return Array.from(groups.values()).sort((a, b) => {
            const gradeA = a.schoolClass?.gradeLevel || 0;
            const gradeB = b.schoolClass?.gradeLevel || 0;
            if (gradeA !== gradeB) return gradeA - gradeB;
            return (a.schoolClass?.name || '').localeCompare(b.schoolClass?.name || '');
        });
    }, [workloads]);

    // Фильтрация по поиску и статусу размещения
    const filteredGroups = useMemo(() => {
        return groupedWorkloads
            .map((group) => {
                let filteredWorkloads = group.workloads;

                // Фильтр по поиску
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    filteredWorkloads = filteredWorkloads.filter(
                        (w) =>
                            w.subject?.name.toLowerCase().includes(query) ||
                            w.teacher?.fullName.toLowerCase().includes(query) ||
                            w.teacher?.shortName.toLowerCase().includes(query)
                    );
                }

                // Фильтр по нераспределённым
                if (showUnplacedOnly) {
                    filteredWorkloads = filteredWorkloads.filter(
                        (w) => (w.placedHours || 0) < w.hoursPerWeek
                    );
                }

                return {
                    ...group,
                    workloads: filteredWorkloads,
                };
            })
            .filter((group) => group.workloads.length > 0);
    }, [groupedWorkloads, searchQuery, showUnplacedOnly]);

    // Статистика
    const totalUnplaced = useMemo(() => {
        return workloads.reduce((sum, w) => {
            return sum + Math.max(0, w.hoursPerWeek - (w.placedHours || 0));
        }, 0);
    }, [workloads]);

    const toggleClassExpanded = (classId: number) => {
        setExpandedClasses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(classId)) {
                newSet.delete(classId);
            } else {
                newSet.add(classId);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedClasses(new Set(groupedWorkloads.map((g) => g.schoolClass?.id).filter((id): id is number => id !== undefined)));
    };

    const collapseAll = () => {
        setExpandedClasses(new Set());
    };

    return (
        <Paper
            sx={{
                width: 280,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: 1,
                borderColor: 'divider',
            }}
        >
            {/* Заголовок */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Нагрузка
                </Typography>

                {/* Поиск */}
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ mb: 1 }}
                />

                {/* Фильтры и статистика */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={showUnplacedOnly}
                                onChange={onToggleFilter}
                            />
                        }
                        label={
                            <Typography variant="caption">
                                Только нераспределённые
                            </Typography>
                        }
                    />
                    <Chip
                        label={`${totalUnplaced} ч.`}
                        size="small"
                        color={totalUnplaced > 0 ? 'warning' : 'success'}
                    />
                </Box>

                {/* Кнопки развернуть/свернуть */}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip
                        label="Развернуть все"
                        size="small"
                        variant="outlined"
                        onClick={expandAll}
                        sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                        label="Свернуть все"
                        size="small"
                        variant="outlined"
                        onClick={collapseAll}
                        sx={{ fontSize: '0.7rem' }}
                    />
                </Box>
            </Box>

            {/* Список нагрузок */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                {filteredGroups.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center', mt: 4 }}
                    >
                        {searchQuery || showUnplacedOnly
                            ? 'Ничего не найдено'
                            : 'Нет нагрузки'}
                    </Typography>
                ) : (
                    filteredGroups.map((group) => {
                        const classId = group.schoolClass?.id || 0;
                        const isExpanded = expandedClasses.has(classId);
                        const unplacedCount = group.workloads.filter(
                            (w) => (w.placedHours || 0) < w.hoursPerWeek
                        ).length;

                        return (
                            <Box key={classId} sx={{ mb: 1 }}>
                                {/* Заголовок класса */}
                                <Paper
                                    sx={{
                                        p: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        bgcolor: 'grey.100',
                                        '&:hover': { bgcolor: 'grey.200' },
                                    }}
                                    onClick={() => toggleClassExpanded(classId)}
                                >
                                    <IconButton size="small">
                                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                    </IconButton>
                                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                                        {group.schoolClass?.name}
                                    </Typography>
                                    {unplacedCount > 0 && (
                                        <Chip
                                            label={unplacedCount}
                                            size="small"
                                            color="warning"
                                            sx={{ height: 20 }}
                                        />
                                    )}
                                </Paper>

                                {/* Список нагрузок класса */}
                                <Collapse in={isExpanded}>
                                    <Box sx={{ pl: 1, pt: 1 }}>
                                        {group.workloads.map((workload) => (
                                            <WorkloadItem
                                                key={workload.id}
                                                workload={workload}
                                            />
                                        ))}
                                    </Box>
                                </Collapse>
                            </Box>
                        );
                    })
                )}
            </Box>
        </Paper>
    );
};

export default WorkloadPanel;
