import React, { useState, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton,
    Chip,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Tooltip,
    Collapse,
    Divider,
} from '@mui/material';
import {
    Close,
    Search,
    Error as ErrorIcon,
    Warning,
    Info,
    ExpandMore,
    ExpandLess,
    OpenInNew,
    CheckCircle,
} from '@mui/icons-material';
import {
    ScheduleConflict,
    ConflictType,
    ConflictCategory,
    CONFLICT_LABELS,
    DAYS_OF_WEEK,
} from '../../types/schedule';

interface ConflictPanelProps {
    conflicts: ScheduleConflict[];
    onConflictClick: (conflict: ScheduleConflict) => void;
    onClose: () => void;
}

const ConflictPanel: React.FC<ConflictPanelProps> = ({
    conflicts,
    onConflictClick,
    onClose,
}) => {
    const [tabValue, setTabValue] = useState<'all' | 'hard' | 'soft'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Фильтрация конфликтов
    const filteredConflicts = useMemo(() => {
        let result = conflicts;

        // Фильтр по типу
        if (tabValue === 'hard') {
            result = result.filter((c) => c.type === ConflictType.HARD);
        } else if (tabValue === 'soft') {
            result = result.filter((c) => c.type === ConflictType.SOFT);
        }

        // Фильтр по поиску
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter((c) =>
                c.description.toLowerCase().includes(query) ||
                CONFLICT_LABELS[c.category]?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [conflicts, tabValue, searchQuery]);

    // Группировка по категориям
    const groupedConflicts = useMemo(() => {
        const groups = new Map<ConflictCategory, ScheduleConflict[]>();

        filteredConflicts.forEach((conflict) => {
            if (!groups.has(conflict.category)) {
                groups.set(conflict.category, []);
            }
            groups.get(conflict.category)!.push(conflict);
        });

        return Array.from(groups.entries()).sort((a, b) => {
            // Сначала hard, потом soft
            const aHasHard = a[1].some((c) => c.type === ConflictType.HARD);
            const bHasHard = b[1].some((c) => c.type === ConflictType.HARD);
            if (aHasHard !== bHasHard) return aHasHard ? -1 : 1;
            return b[1].length - a[1].length;
        });
    }, [filteredConflicts]);

    // Статистика
    const hardCount = conflicts.filter((c) => c.type === ConflictType.HARD).length;
    const softCount = conflicts.filter((c) => c.type === ConflictType.SOFT).length;

    const toggleCategory = (category: ConflictCategory) => {
        setExpandedCategories((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    const getConflictIcon = (type: ConflictType) => {
        return type === ConflictType.HARD ? (
            <ErrorIcon color="error" />
        ) : (
            <Warning color="warning" />
        );
    };

    const formatSlot = (dayOfWeek?: number, lessonNumber?: number) => {
        if (!dayOfWeek || !lessonNumber) return '';
        const day = DAYS_OF_WEEK.find((d) => d.num === dayOfWeek);
        return `${day?.short || ''}, ${lessonNumber} урок`;
    };

    return (
        <Box sx={{ width: 350, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Заголовок */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Конфликты
                </Typography>
                <IconButton onClick={onClose}>
                    <Close />
                </IconButton>
            </Box>

            {/* Статистика */}
            <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
                {hardCount > 0 && (
                    <Chip
                        icon={<ErrorIcon />}
                        label={`${hardCount} ошибок`}
                        color="error"
                        size="small"
                    />
                )}
                {softCount > 0 && (
                    <Chip
                        icon={<Warning />}
                        label={`${softCount} предупреждений`}
                        color="warning"
                        size="small"
                    />
                )}
                {hardCount === 0 && softCount === 0 && (
                    <Chip
                        icon={<CheckCircle />}
                        label="Нет конфликтов"
                        color="success"
                        size="small"
                    />
                )}
            </Box>

            {/* Табы фильтрации */}
            <Tabs
                value={tabValue}
                onChange={(_, v) => setTabValue(v)}
                sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label={`Все (${conflicts.length})`} value="all" />
                <Tab label={`Ошибки (${hardCount})`} value="hard" />
                <Tab label={`Предупреждения (${softCount})`} value="soft" />
            </Tabs>

            {/* Поиск */}
            <Box sx={{ p: 2 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Поиск конфликтов..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>

            {/* Список конфликтов */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {groupedConflicts.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CheckCircle color="success" sx={{ fontSize: 48, mb: 2 }} />
                        <Typography color="text.secondary">
                            {searchQuery
                                ? 'Ничего не найдено'
                                : 'Конфликтов не обнаружено'}
                        </Typography>
                    </Box>
                ) : (
                    groupedConflicts.map(([category, categoryConflicts]) => {
                        const isExpanded = expandedCategories.has(category);
                        const hasHard = categoryConflicts.some((c) => c.type === ConflictType.HARD);

                        return (
                            <Box key={category}>
                                {/* Заголовок категории */}
                                <Paper
                                    sx={{
                                        mx: 2,
                                        mb: 1,
                                        p: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        bgcolor: hasHard ? 'error.lighter' : 'warning.lighter',
                                        '&:hover': {
                                            bgcolor: hasHard ? 'error.light' : 'warning.light',
                                        },
                                    }}
                                    onClick={() => toggleCategory(category)}
                                >
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        {hasHard ? (
                                            <ErrorIcon color="error" />
                                        ) : (
                                            <Warning color="warning" />
                                        )}
                                    </ListItemIcon>
                                    <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                                        {CONFLICT_LABELS[category] || category}
                                    </Typography>
                                    <Chip
                                        label={categoryConflicts.length}
                                        size="small"
                                        color={hasHard ? 'error' : 'warning'}
                                    />
                                    <IconButton size="small">
                                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                    </IconButton>
                                </Paper>

                                {/* Список конфликтов в категории */}
                                <Collapse in={isExpanded}>
                                    <List dense sx={{ px: 2 }}>
                                        {categoryConflicts.map((conflict) => (
                                            <ListItem
                                                key={conflict.id}
                                                sx={{
                                                    mb: 0.5,
                                                    bgcolor: 'background.paper',
                                                    borderRadius: 1,
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    },
                                                }}
                                                onClick={() => onConflictClick(conflict)}
                                            >
                                                <ListItemIcon sx={{ minWidth: 32 }}>
                                                    {getConflictIcon(conflict.type)}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body2">
                                                            {conflict.description}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Box sx={{ mt: 0.5 }}>
                                                            {conflict.dayOfWeek && conflict.lessonNumber && (
                                                                <Chip
                                                                    label={formatSlot(
                                                                        conflict.dayOfWeek,
                                                                        conflict.lessonNumber
                                                                    )}
                                                                    size="small"
                                                                    sx={{ mr: 0.5, height: 20 }}
                                                                />
                                                            )}
                                                            {conflict.sanpinReference && (
                                                                <Tooltip title={conflict.sanpinReference}>
                                                                    <Chip
                                                                        label="СанПиН"
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ height: 20 }}
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                    }
                                                />
                                                <IconButton size="small">
                                                    <OpenInNew fontSize="small" />
                                                </IconButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Collapse>
                            </Box>
                        );
                    })
                )}
            </Box>
        </Box>
    );
};

export default ConflictPanel;
