import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    Chip,
} from '@mui/material';
import {
    DragIndicator,
    MoreVert,
    Lock,
    LockOpen,
    Delete,
    Edit,
    SwapHoriz,
    Warning,
    Error as ErrorIcon,
} from '@mui/icons-material';
import { useDrag, DragSourceMonitor } from 'react-dnd';
import { ScheduleLesson, ConflictType } from '../../types/schedule';

interface LessonCardProps {
    lesson: ScheduleLesson;
    compact?: boolean;
    hasConflict?: boolean;
    conflictType?: ConflictType;
    onRemove?: () => void;
    onEdit?: () => void;
    onToggleLock?: () => void;
    onSwap?: () => void;
}

const LessonCard: React.FC<LessonCardProps> = ({
    lesson,
    compact = false,
    hasConflict = false,
    conflictType,
    onRemove,
    onEdit,
    onToggleLock,
    onSwap,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const ref = useRef<HTMLDivElement>(null);

    // Drag & Drop
    const [{ isDragging }, drag, preview] = useDrag({
        type: 'LESSON',
        item: { type: 'LESSON', id: lesson.id, workloadId: lesson.workloadId },
        collect: (monitor: DragSourceMonitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    // Подключаем drag и preview к ref
    useEffect(() => {
        if (ref.current) {
            drag(ref.current);
            preview(ref.current);
        }
    }, [drag, preview]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleAction = (action: () => void) => {
        handleMenuClose();
        action();
    };

    // Получаем данные для отображения
    const subject = lesson.subject || lesson.workload?.subject;
    const teacher = lesson.teacher || lesson.workload?.teacher;
    const room = lesson.room || lesson.workload?.room;
    const schoolClass = lesson.schoolClass || lesson.workload?.schoolClass;
    const group = lesson.group || lesson.workload?.group;

    // Цвет фона на основе предмета
    const bgColor = subject?.color || '#E3F2FD';
    const textColor = getContrastColor(bgColor);

    // Определяем иконку конфликта
    const ConflictIcon = conflictType === ConflictType.HARD ? ErrorIcon : Warning;
    const conflictColor = conflictType === ConflictType.HARD ? 'error' : 'warning';

    if (compact) {
        return (
            <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
                <Paper
                    elevation={isDragging ? 4 : 1}
                    sx={{
                        p: 0.5,
                        mb: 0.5,
                        bgcolor: bgColor,
                        color: textColor,
                        cursor: 'grab',
                        position: 'relative',
                        borderLeft: hasConflict ? `3px solid` : 'none',
                        borderLeftColor: hasConflict ? `${conflictColor}.main` : 'transparent',
                        '&:hover': {
                            boxShadow: 3,
                        },
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DragIndicator fontSize="small" sx={{ opacity: 0.5 }} />
                        {(schoolClass as any)?.shift === 2 && (
                            <Box component="span" title="2 смена" sx={{ fontSize: '0.55rem', fontWeight: 700, bgcolor: '#8e24aa', color: '#fff', borderRadius: '4px', px: 0.4, lineHeight: 1.5, flexShrink: 0 }}>2см</Box>
                        )}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 600,
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {subject?.shortName || subject?.name || 'Предмет'}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    opacity: 0.8,
                                    fontSize: '0.65rem',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {teacher?.shortName || teacher?.fullName}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{
                                    opacity: 0.7,
                                    fontSize: '0.6rem',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {schoolClass?.name || ''}{group ? ` (${group.name})` : ''}{room ? ` • каб. ${room.name}` : ''}
                            </Typography>
                        </Box>

                        {lesson.isLocked && (
                            <Lock fontSize="small" sx={{ opacity: 0.5 }} />
                        )}

                        {hasConflict && (
                            <Tooltip title={conflictType === ConflictType.HARD ? 'Ошибка' : 'Предупреждение'}>
                                <ConflictIcon fontSize="small" color={conflictColor as any} />
                            </Tooltip>
                        )}

                        <IconButton
                            size="small"
                            onClick={handleMenuOpen}
                            sx={{ p: 0.25, color: textColor }}
                        >
                            <MoreVert fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Контекстное меню */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                    >
                        {onEdit && (
                            <MenuItem onClick={() => handleAction(onEdit)}>
                                <Edit fontSize="small" sx={{ mr: 1 }} />
                                Редактировать
                            </MenuItem>
                        )}
                        {onToggleLock && (
                            <MenuItem onClick={() => handleAction(onToggleLock)}>
                                {lesson.isLocked ? (
                                    <>
                                        <LockOpen fontSize="small" sx={{ mr: 1 }} />
                                        Разблокировать
                                    </>
                                ) : (
                                    <>
                                        <Lock fontSize="small" sx={{ mr: 1 }} />
                                        Заблокировать
                                    </>
                                )}
                            </MenuItem>
                        )}
                        {onSwap && (
                            <MenuItem onClick={() => handleAction(onSwap)}>
                                <SwapHoriz fontSize="small" sx={{ mr: 1 }} />
                                Поменять местами
                            </MenuItem>
                        )}
                        {onRemove && (
                            <MenuItem onClick={() => handleAction(onRemove)} sx={{ color: 'error.main' }}>
                                <Delete fontSize="small" sx={{ mr: 1 }} />
                                Удалить
                            </MenuItem>
                        )}
                    </Menu>
                </Paper>
            </div>
        );
    }

    // Полная версия карточки
    return (
        <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>
            <Paper
                elevation={isDragging ? 4 : 2}
                sx={{
                    p: 1.5,
                    bgcolor: bgColor,
                    color: textColor,
                    cursor: 'grab',
                    position: 'relative',
                    borderLeft: hasConflict ? `4px solid` : 'none',
                    borderLeftColor: hasConflict ? `${conflictColor}.main` : 'transparent',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <DragIndicator sx={{ opacity: 0.5, mt: 0.5 }} />

                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {subject?.name || 'Предмет'}
                        </Typography>
                        
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            {teacher?.fullName || teacher?.shortName}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                            <Chip
                                label={schoolClass?.name}
                                size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.3)' }}
                            />
                            {group && (
                                <Chip
                                    label={group.name}
                                    size="small"
                                    variant="outlined"
                                    sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
                                />
                            )}
                            {room && (
                                <Chip
                                    label={`каб. ${room.name}`}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.3)' }}
                                />
                            )}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        {lesson.isLocked && (
                            <Tooltip title="Заблокирован">
                                <Lock fontSize="small" sx={{ opacity: 0.7 }} />
                            </Tooltip>
                        )}
                        {hasConflict && (
                            <Tooltip title={conflictType === ConflictType.HARD ? 'Ошибка' : 'Предупреждение'}>
                                <ConflictIcon color={conflictColor as any} />
                            </Tooltip>
                        )}
                        <IconButton
                            size="small"
                            onClick={handleMenuOpen}
                            sx={{ color: textColor }}
                        >
                            <MoreVert />
                        </IconButton>
                    </Box>
                </Box>

                {/* Контекстное меню */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                    {onEdit && (
                        <MenuItem onClick={() => handleAction(onEdit)}>
                            <Edit fontSize="small" sx={{ mr: 1 }} />
                            Редактировать
                        </MenuItem>
                    )}
                    {onToggleLock && (
                        <MenuItem onClick={() => handleAction(onToggleLock)}>
                            {lesson.isLocked ? (
                                <>
                                    <LockOpen fontSize="small" sx={{ mr: 1 }} />
                                    Разблокировать
                                </>
                            ) : (
                                <>
                                    <Lock fontSize="small" sx={{ mr: 1 }} />
                                    Заблокировать
                                </>
                            )}
                        </MenuItem>
                    )}
                    {onSwap && (
                        <MenuItem onClick={() => handleAction(onSwap)}>
                            <SwapHoriz fontSize="small" sx={{ mr: 1 }} />
                            Поменять местами
                        </MenuItem>
                    )}
                    {onRemove && (
                        <MenuItem onClick={() => handleAction(onRemove)} sx={{ color: 'error.main' }}>
                            <Delete fontSize="small" sx={{ mr: 1 }} />
                            Удалить
                        </MenuItem>
                    )}
                </Menu>
            </Paper>
        </div>
    );
};

// Утилита для определения контрастного цвета текста
function getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default LessonCard;
