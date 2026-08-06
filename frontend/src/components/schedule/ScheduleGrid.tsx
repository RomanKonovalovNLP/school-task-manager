import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useDrop, DropTargetMonitor } from 'react-dnd';
import LessonCard from './LessonCard';
import { ScheduleLesson, ScheduleConflict, WorkloadWeekType, DAYS_OF_WEEK, isDayWorking, WORKING_DAYS_5 } from '../../types/schedule';

interface ScheduleGridProps {
    lessons: ScheduleLesson[]; viewMode: 'class' | 'teacher' | 'room'; selectedEntity: number | null;
    conflicts: ScheduleConflict[]; weekType: 'single' | 'odd_even'; maxLessons: number;
    workingDays?: number; highlightedLessonIds?: Set<number>;
    substitutedLessonIds?: Set<number>;
    onLessonMove: (lessonId: number, targetSlot: any, roomId?: number) => void;
    onLessonRemove: (lessonId: number) => void; onSlotClick: (slot: any) => void;
    onCellContextMenu?: (e: React.MouseEvent, dayOfWeek: number, lessonNumber: number, lesson?: ScheduleLesson) => void;
}

interface SlotCellProps {
    dayOfWeek: number; lessonNumber: number; lessons: ScheduleLesson[]; conflicts: ScheduleConflict[];
    highlightedLessonIds?: Set<number>; substitutedLessonIds?: Set<number>; onDrop: (item: any) => void;
    onLessonRemove: (lessonId: number) => void; onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

const SlotCell: React.FC<SlotCellProps> = ({ dayOfWeek, lessonNumber, lessons, conflicts, highlightedLessonIds, substitutedLessonIds, onDrop, onLessonRemove, onClick, onContextMenu }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['LESSON', 'WORKLOAD'],
        drop: (item: any) => onDrop(item),
        // Разрешаем класть в ячейку, даже если в ней уже есть уроки других классов
        // (нужно для сводного вида по нескольким классам); конфликты проверит бэкенд.
        canDrop: () => true,
        collect: (monitor: DropTargetMonitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    });
    useEffect(() => { if (ref.current) drop(ref.current); }, [drop]);

    const hasHard = conflicts.some(c => c.type === 'hard' && c.dayOfWeek === dayOfWeek && c.lessonNumber === lessonNumber);
    const hasSoft = conflicts.some(c => c.type === 'soft' && c.dayOfWeek === dayOfWeek && c.lessonNumber === lessonNumber);
    const hasHL = highlightedLessonIds && highlightedLessonIds.size > 0 && lessons.some(l => highlightedLessonIds.has(l.id));
    const hasDim = highlightedLessonIds && highlightedLessonIds.size > 0 && !hasHL && lessons.length > 0;
    const hasSub = substitutedLessonIds && lessons.some(l => substitutedLessonIds.has(l.id));

    // Полупрозрачная заливка вместо пастельных оттенков: на светлом фоне она
    // выглядит как бледная подсветка, на тёмном — как тёмный оттенок того же
    // цвета, поэтому одинаково читается в обеих темах.
    let bgcolor = 'background.default', borderColor = 'divider';
    if (isOver && canDrop) { bgcolor = 'rgba(76,175,80,0.22)'; borderColor = 'success.main'; }
    else if (isOver) { bgcolor = 'rgba(244,67,54,0.22)'; borderColor = 'error.main'; }
    else if (hasHL) { bgcolor = 'rgba(255,152,0,0.22)'; borderColor = '#e65100'; }
    else if (hasHard) { bgcolor = 'rgba(244,67,54,0.18)'; borderColor = 'error.main'; }
    else if (hasSoft) { bgcolor = 'rgba(255,193,7,0.18)'; borderColor = 'warning.main'; }

    return (
        <div ref={ref}>
            <Box onClick={onClick} onContextMenu={onContextMenu} sx={{ position: 'relative', minHeight: 80, border: hasHL ? 2 : 1, borderColor, bgcolor, borderRadius: 1, p: 0.5,
                transition: 'all 0.2s', cursor: 'pointer', opacity: hasDim ? 0.4 : 1,
                boxShadow: hasSub ? '0 0 0 2px #7b1fa2 inset' : undefined,
                '&:hover': { bgcolor: lessons.length === 0 ? 'action.hover' : undefined } }}>
                {hasSub && (
                    <SwapHorizIcon sx={{ position: 'absolute', top: 2, right: 2, fontSize: 16, color: '#7b1fa2', zIndex: 2 }} />
                )}
                {lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} compact onRemove={() => onLessonRemove(lesson.id)} hasConflict={hasHard || hasSoft} />)}
            </Box>
        </div>
    );
};

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ lessons, conflicts, maxLessons, workingDays = WORKING_DAYS_5, highlightedLessonIds, substitutedLessonIds, onLessonMove, onLessonRemove, onSlotClick, onCellContextMenu }) => {
    const nums = Array.from({ length: maxLessons }, (_, i) => i + 1);
    const days = DAYS_OF_WEEK.filter(d => d.num <= 7 && isDayWorking(workingDays, d.num));
    const getLessons = (d: number, n: number) => lessons.filter(l => l.dayOfWeek === d && l.lessonNumber === n);
    const getConf = (d: number, n: number) => conflicts.filter(c => c.dayOfWeek === d && c.lessonNumber === n);
    const handleDrop = (d: number, n: number, item: any) => {
        if (item.type === 'LESSON') onLessonMove(item.id, { dayOfWeek: d, lessonNumber: n, weekType: WorkloadWeekType.BOTH });
        else if (item.type === 'WORKLOAD') onLessonMove(0, { dayOfWeek: d, lessonNumber: n, weekType: WorkloadWeekType.BOTH, workloadId: item.id });
    };

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, gap: 0.5, minWidth: 800 }}>
                <Box />
                {days.map(day => <Paper key={day.num} sx={{ p: 1, textAlign: 'center', bgcolor: day.num === 6 ? 'secondary.main' : 'primary.main', color: day.num === 6 ? 'secondary.contrastText' : 'primary.contrastText' }}><Typography variant="subtitle2">{day.name}</Typography></Paper>)}
                {nums.map(n => (
                    <React.Fragment key={n}>
                        <Paper sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}><Typography variant="subtitle2">{n}</Typography></Paper>
                        {days.map(d => {
                            const cellLessons = getLessons(d.num, n);
                            return (
                                <SlotCell key={`${d.num}-${n}`} dayOfWeek={d.num} lessonNumber={n} lessons={cellLessons} conflicts={getConf(d.num, n)}
                                    highlightedLessonIds={highlightedLessonIds} substitutedLessonIds={substitutedLessonIds}
                                    onDrop={(item) => handleDrop(d.num, n, item)} onLessonRemove={onLessonRemove}
                                    onClick={() => onSlotClick({ dayOfWeek: d.num, lessonNumber: n })}
                                    onContextMenu={onCellContextMenu ? (e) => { e.preventDefault(); onCellContextMenu(e, d.num, n, cellLessons[0]); } : undefined} />
                            );
                        })}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default ScheduleGrid;
