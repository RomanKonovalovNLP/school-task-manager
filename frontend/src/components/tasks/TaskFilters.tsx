import React from 'react';
import {
    Box,
    TextField,
    MenuItem,
    IconButton,
    Button,
    Tooltip,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Refresh, Clear, DeleteSweep } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { setFilters, clearFilters } from '../../store/slices/tasksSlice';
import { tasksService } from '../../services/tasks.service';

const PRIORITY_LABELS: Record<string, string> = {
    important: 'Важные', urgent: 'Срочные', medium: 'Средние', low: 'Несрочные', overdue: 'Просроченные',
};

interface TaskFiltersProps {
    onRefresh: () => void;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({ onRefresh }) => {
    const { filters } = useAppSelector((state) => state.tasks);
    const { categories } = useAppSelector((state) => state.filters);
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleFilterChange = (field: string, value: string) => {
        dispatch(setFilters({ [field]: value }));
    };

    const handleClearFilters = () => {
        dispatch(clearFilters());
    };

    const handleDeleteOverdue = async () => {
        if (
            window.confirm(
                'Вы уверены, что хотите удалить все просроченные задачи?'
            )
        ) {
            try {
                const result = await tasksService.deleteOverdue();
                alert(`Удалено задач: ${result.count}`);
                onRefresh();
            } catch (error: any) {
                alert(
                    error.response?.data?.message ||
                    'Ошибка при удалении просроченных задач'
                );
            }
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 2,
                alignItems: isMobile ? 'stretch' : 'center',
                // Даём панели сжиматься, чтобы фильтры справа не уезжали на вторую строку
                minWidth: 0,
                flexShrink: 1,
            }}
        >
            {/* Фильтр по категории */}
            <TextField
                select
                label="Категория"
                size="small"
                value={filters.category}
                onChange={(e) => {
                    const v = e.target.value as unknown as string[] | string;
                    const arr = Array.isArray(v) ? v : String(v).split(',').filter(Boolean);
                    if (arr.includes('__all__')) {
                        // «Все категории» = пустой выбор; тогда клик по конкретной оставит только её
                        dispatch(setFilters({ category: [] }));
                        return;
                    }
                    dispatch(setFilters({ category: arr }));
                }}
                sx={{ minWidth: isMobile ? '100%' : 150, maxWidth: isMobile ? '100%' : 220, flexShrink: 1 }}
                InputLabelProps={{ shrink: true }}
                SelectProps={{
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (selected: any) => {
                        const arr = selected as string[];
                        if (arr.length === 0) return 'Все категории';
                        const labelOf = (v: string) => v === '__forme__' ? 'Для меня' : v === '__personal__' ? 'Персонально' : v;
                        const realCats = arr.filter((v) => !v.startsWith('__'));
                        if (arr.length === realCats.length && realCats.length === categories.length) return 'Все категории';
                        return arr.map(labelOf).join(', ');
                    },
                }}
            >
                <MenuItem value="__all__" sx={{ fontWeight: 600 }}>
                    Все категории
                </MenuItem>
                <MenuItem value="__forme__">Для меня</MenuItem>
                {user?.isAdmin && <MenuItem value="__personal__">Персонально (все адресные)</MenuItem>}
                {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.categoryName}>
                        {cat.categoryName}
                    </MenuItem>
                ))}
            </TextField>

            {/* Фильтр по приоритету (множественный выбор) */}
            <TextField
                select
                label="Приоритет"
                size="small"
                value={filters.priority}
                onChange={(e) => {
                    const v = e.target.value as unknown as string[] | string;
                    const arr = Array.isArray(v) ? v : String(v).split(',').filter(Boolean);
                    dispatch(setFilters({ priority: arr }));
                }}
                sx={{ minWidth: isMobile ? '100%' : 150, maxWidth: isMobile ? '100%' : 220, flexShrink: 1 }}
                InputLabelProps={{ shrink: true }}
                SelectProps={{
                    multiple: true,
                    displayEmpty: true,
                    renderValue: (selected: any) => {
                        const arr = selected as string[];
                        return arr.length === 0 ? 'Все приоритеты' : arr.map((v) => PRIORITY_LABELS[v] || v).join(', ');
                    },
                }}
            >
                <MenuItem value="important">Важные</MenuItem>
                <MenuItem value="urgent">Срочные</MenuItem>
                <MenuItem value="medium">Средние</MenuItem>
                <MenuItem value="low">Несрочные</MenuItem>
                <MenuItem value="overdue">Просроченные</MenuItem>
            </TextField>

            {/* Кнопки действий */}
            <Box
                sx={{
                    display: 'flex',
                    gap: 1,
                    ml: isMobile ? 0 : 'auto',
                }}
            >
                <Tooltip title="Обновить">
                    <IconButton onClick={onRefresh} color="primary">
                        <Refresh />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Сбросить фильтры">
                    <IconButton onClick={handleClearFilters} color="default">
                        <Clear />
                    </IconButton>
                </Tooltip>

                {user?.isAdmin && (
                    <Tooltip title="Удалить просроченные">
                        <IconButton onClick={handleDeleteOverdue} color="error">
                            <DeleteSweep />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};

export default TaskFilters;