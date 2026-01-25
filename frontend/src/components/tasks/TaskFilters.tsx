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
            }}
        >
            {/* Фильтр по категории */}
            <TextField
                select
                label="Категория"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                size="small"
                sx={{ minWidth: isMobile ? '100%' : 200 }}
            >
                <MenuItem value="">Все категории</MenuItem>
                {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.categoryName}>
                        {cat.categoryName}
                    </MenuItem>
                ))}
            </TextField>

            {/* Фильтр по приоритету */}
            <TextField
                select
                label="Приоритет"
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                size="small"
                sx={{ minWidth: isMobile ? '100%' : 200 }}
            >
                <MenuItem value="">Все приоритеты</MenuItem>
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