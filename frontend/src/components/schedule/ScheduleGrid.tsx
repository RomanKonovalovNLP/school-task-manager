import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useDrop, DropTargetMonitor } from 'react-dnd';
import LessonCard from './LessonCard';
import { ScheduleLesson, ScheduleConflict, WorkloadWeekType, DAYS_OF_WEEK, isDayWorking, WORKING_DAYS_5 } from '../../types/schedule';

interface ScheduleGridProps {
    lessons: ScheduleLesson[]; viewMode: 'class' | 'teacher' | 'room'; selectedEntity: number | null;
    conflicts: ScheduleConflict[]; weekType: 'single' | 'odd_even'; maxLessons: number;
    workingDays?: number; highlightedLessonIds?: Set<number>;
    onLessonMove: (lessonId: number, targetSlot: any, roomId?: number) => void;
    onLessonRemove: (lessonId: number) => void; onSlotClick: (slot: any) => void;
}

interface SlotCellProps {
    dayOfWeek: number; lessonNumber: number; lessons: ScheduleLesson[]; conflicts: ScheduleConflict[];
    highlightedLessonIds?: Set<number>; onDrop: (item: any) => void;
    onLessonRemove: (lessonId: number) => void; onClick: () => void;
}

const SlotCell: React.FC<SlotCellProps> = ({ dayOfWeek, lessonNumber, lessons, conflicts, highlightedLessonIds, onDrop, onLessonRemove, onClick }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['LESSON', 'WORKLOAD'],
        drop: (item: any) => onDrop(item),
        canDrop: (item: any) => { if (item.type === 'LESSON' && item.id && lessons.find(l => l.id === item.id)) return true; return lessons.length === 0; },
        collect: (monitor: DropTargetMonitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    });
    useEffect(() => { if (ref.current) drop(ref.current); }, [drop]);

    const hasHard = conflicts.some(c => c.type === 'hard' && c.dayOfWeek === dayOfWeek && c.lessonNumber === lessonNumber);
    const hasSoft = conflicts.some(c => c.type === 'soft' && c.dayOfWeek === dayOfWeek && c.lessonNumber === lessonNumber);
    const hasHL = highlightedLessonIds && highlightedLessonIds.size > 0 && lessons.some(l => highlightedLessonIds.has(l.id));
    const hasDim = highlightedLessonIds && highlightedLessonIds.size > 0 && !hasHL && lessons.length > 0;

    let bgcolor = 'background.default', borderColor = 'divider';
    if (isOver && canDrop) { bgcolor = 'success.light'; borderColor = 'success.main'; }
    else if (isOver) { bgcolor = 'error.light'; borderColor = 'error.main'; }
    else if (hasHL) { bgcolor = '#fff3e0'; borderColor = '#e65100'; }
    else if (hasHard) { bgcolor = '#ffebee'; borderColor = 'error.main'; }
    else if (hasSoft) { bgcolor = '#fff8e1'; borderColor = 'warning.main'; }

    return (
        <div ref={ref}>
            <Box onClick={onClick} sx={{ minHeight: 80, border: hasHL ? 2 : 1, borderColor, bgcolor, borderRadius: 1, p: 0.5,
                transition: 'all 0.2s', cursor: 'pointer', opacity: hasDim ? 0.4 : 1,
                '&:hover': { bgcolor: lessons.length === 0 ? 'action.hover' : undefined } }}>
                {lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} compact onRemove={() => onLessonRemove(lesson.id)} hasConflict={hasHard || hasSoft} />)}
            </Box>
        </div>
    );
};

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ lessons, conflicts, maxLessons, workingDays = WORKING_DAYS_5, highlightedLessonIds, onLessonMove, onLessonRemove, onSlotClick }) => {
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
                        {days.map(d => <SlotCell key={`${d.num}-${n}`} dayOfWeek={d.num} lessonNumber={n} lessons={getLessons(d.num, n)} conflicts={getConf(d.num, n)} highlightedLessonIds={highlightedLessonIds} onDrop={(item) => handleDrop(d.num, n, item)} onLessonRemove={onLessonRemove} onClick={() => onSlotClick({ dayOfWeek: d.num, lessonNumber: n })} />)}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default ScheduleGrid;
