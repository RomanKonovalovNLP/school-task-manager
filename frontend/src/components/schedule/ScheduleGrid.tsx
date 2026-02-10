import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useDrop, DropTargetMonitor } from 'react-dnd';
import LessonCard from './LessonCard';
import { ScheduleLesson, ScheduleConflict, WorkloadWeekType } from '../../types/schedule';

interface ScheduleGridProps {
    lessons: ScheduleLesson[];
    viewMode: 'class' | 'teacher' | 'room';
    selectedEntity: number | null;
    conflicts: ScheduleConflict[];
    weekType: 'single' | 'odd_even';
    maxLessons: number;
    onLessonMove: (lessonId: number, targetSlot: any, roomId?: number) => void;
    onLessonRemove: (lessonId: number) => void;
    onSlotClick: (slot: any) => void;
}

const DAYS = [
    { num: 1, name: 'Понедельник', short: 'Пн' },
    { num: 2, name: 'Вторник', short: 'Вт' },
    { num: 3, name: 'Среда', short: 'Ср' },
    { num: 4, name: 'Четверг', short: 'Чт' },
    { num: 5, name: 'Пятница', short: 'Пт' },
    { num: 6, name: 'Суббота', short: 'Сб' },
];

// Ячейка слота (drop target)
interface SlotCellProps {
    dayOfWeek: number;
    lessonNumber: number;
    weekType: WorkloadWeekType;
    lessons: ScheduleLesson[];
    conflicts: ScheduleConflict[];
    onDrop: (item: any) => void;
    onLessonRemove: (lessonId: number) => void;
    onClick: () => void;
}

const SlotCell: React.FC<SlotCellProps> = ({
    dayOfWeek,
    lessonNumber,
    lessons,
    conflicts,
    onDrop,
    onLessonRemove,
    onClick,
}) => {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['LESSON', 'WORKLOAD'],
        drop: (item: any) => {
            onDrop(item);
        },
        canDrop: (item: any) => {
            if (item.type === 'LESSON' && item.id) {
                const existingLesson = lessons.find(l => l.id === item.id);
                if (existingLesson) return true;
            }
            return lessons.length === 0;
        },
        collect: (monitor: DropTargetMonitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    useEffect(() => {
        if (ref.current) {
            drop(ref.current);
        }
    }, [drop]);

    const hasHardConflict = conflicts.some(c => 
        c.type === 'hard' && 
        c.dayOfWeek === dayOfWeek && 
        c.lessonNumber === lessonNumber
    );

    const hasSoftConflict = conflicts.some(c => 
        c.type === 'soft' && 
        c.dayOfWeek === dayOfWeek && 
        c.lessonNumber === lessonNumber
    );

    let bgcolor = 'background.default';
    let borderColor = 'divider';
    
    if (isOver && canDrop) {
        bgcolor = 'success.light';
        borderColor = 'success.main';
    } else if (isOver && !canDrop) {
        bgcolor = 'error.light';
        borderColor = 'error.main';
    } else if (hasHardConflict) {
        bgcolor = 'error.lighter';
        borderColor = 'error.main';
    } else if (hasSoftConflict) {
        bgcolor = 'warning.lighter';
        borderColor = 'warning.main';
    }

    return (
        <div ref={ref}>
            <Box
                onClick={onClick}
                sx={{
                    minHeight: 80,
                    border: 1,
                    borderColor,
                    bgcolor,
                    borderRadius: 1,
                    p: 0.5,
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    '&:hover': {
                        bgcolor: lessons.length === 0 ? 'action.hover' : undefined,
                    },
                }}
            >
                {lessons.map(lesson => (
                    <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        compact
                        onRemove={() => onLessonRemove(lesson.id)}
                        hasConflict={hasHardConflict || hasSoftConflict}
                    />
                ))}
            </Box>
        </div>
    );
};

const ScheduleGrid: React.FC<ScheduleGridProps> = ({
    lessons,
    conflicts,
    weekType,
    maxLessons,
    onLessonMove,
    onLessonRemove,
    onSlotClick,
}) => {
    const lessonNumbers = Array.from({ length: maxLessons }, (_, i) => i + 1);

    const getLessonsForSlot = (
        dayOfWeek: number,
        lessonNumber: number,
        week: WorkloadWeekType = WorkloadWeekType.BOTH,
    ): ScheduleLesson[] => {
        return lessons.filter(l => {
            if (l.dayOfWeek !== dayOfWeek || l.lessonNumber !== lessonNumber) {
                return false;
            }
            if (weekType === 'single') {
                return true;
            }
            if (l.weekType === WorkloadWeekType.BOTH) return true;
            return l.weekType === week;
        });
    };

    const getConflictsForSlot = (dayOfWeek: number, lessonNumber: number): ScheduleConflict[] => {
        return conflicts.filter(c => 
            c.dayOfWeek === dayOfWeek && c.lessonNumber === lessonNumber
        );
    };

    const handleDrop = (
        dayOfWeek: number,
        lessonNumber: number,
        week: WorkloadWeekType,
        item: any,
    ) => {
        if (item.type === 'LESSON') {
            onLessonMove(item.id, { dayOfWeek, lessonNumber, weekType: week });
        } else if (item.type === 'WORKLOAD') {
            onLessonMove(0, { dayOfWeek, lessonNumber, weekType: week, workloadId: item.id });
        }
    };

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`,
                    gridTemplateRows: `auto repeat(${maxLessons}, 1fr)`,
                    gap: 0.5,
                    minWidth: 800,
                }}
            >
                <Box />

                {DAYS.map(day => (
                    <Paper
                        key={day.num}
                        sx={{
                            p: 1,
                            textAlign: 'center',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                        }}
                    >
                        <Typography variant="subtitle2">{day.name}</Typography>
                    </Paper>
                ))}

                {lessonNumbers.map(lessonNum => (
                    <React.Fragment key={lessonNum}>
                        <Paper
                            sx={{
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.100',
                            }}
                        >
                            <Typography variant="subtitle2">{lessonNum}</Typography>
                        </Paper>

                        {DAYS.map(day => {
                            const slotLessons = getLessonsForSlot(day.num, lessonNum);
                            const slotConflicts = getConflictsForSlot(day.num, lessonNum);

                            return (
                                <SlotCell
                                    key={`${day.num}-${lessonNum}`}
                                    dayOfWeek={day.num}
                                    lessonNumber={lessonNum}
                                    weekType={WorkloadWeekType.BOTH}
                                    lessons={slotLessons}
                                    conflicts={slotConflicts}
                                    onDrop={(item) => handleDrop(day.num, lessonNum, WorkloadWeekType.BOTH, item)}
                                    onLessonRemove={onLessonRemove}
                                    onClick={() => onSlotClick({ dayOfWeek: day.num, lessonNumber: lessonNum })}
                                />
                            );
                        })}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default ScheduleGrid;
