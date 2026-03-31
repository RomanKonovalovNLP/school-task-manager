import React, { useEffect, useState } from 'react';
import {
    Box,
    Fab,
    useMediaQuery,
    useTheme,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    Add,
    ViewList,
    Dashboard as DashboardIcon,
    People,
    PersonOutline,
} from '@mui/icons-material';
import MainLayout from '../components/layout/MainLayout';
import TaskList from '../components/tasks/TaskList';
import TaskCanvas from '../components/tasks/TaskCanvas';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskModal from '../components/tasks/TaskModal';
import TaskFilters from '../components/tasks/TaskFilters';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { setTasks, setLoading } from '../store/slices/tasksSlice';
import { setCategories } from '../store/slices/filtersSlice';
import { tasksService } from '../services/tasks.service';
import { filtersService } from '../services/filters.service';

const DashboardPage: React.FC = () => {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');
    const dispatch = useAppDispatch();
    const { filters } = useAppSelector((state) => state.tasks);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Фильтры по типу задач (множественный выбор)
    const [taskTypeFilter, setTaskTypeFilter] = useState<string[]>(['shared', 'personal']);

    const showShared = taskTypeFilter.includes('shared');
    const showPersonal = taskTypeFilter.includes('personal');

    useEffect(() => {
        if (isMobile) {
            setViewMode('list');
        }
    }, [isMobile]);

    useEffect(() => {
        loadTasks();
        loadCategories();
    }, []);

    useEffect(() => {
        loadTasks();
    }, [filters, showShared, showPersonal]);

    const loadTasks = async () => {
        dispatch(setLoading(true));
        try {
            const tasks = await tasksService.getAll({
                category: filters.category || undefined,
                priority: filters.priority || undefined,
                creatorName: filters.creatorName || undefined,
                showShared,
                showPersonal,
            });
            dispatch(setTasks(tasks));
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    };

    const loadCategories = async () => {
        try {
            const categories = await filtersService.getAll();
            dispatch(setCategories(categories));
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const handleViewModeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newMode: 'list' | 'canvas' | null,
    ) => {
        if (newMode !== null) {
            setViewMode(newMode);
        }
    };

    const handleTaskTypeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newFilter: string[],
    ) => {
        // Не позволяем снять оба фильтра
        if (newFilter.length > 0) {
            setTaskTypeFilter(newFilter);
        }
    };

    return (
        <MainLayout>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <TaskFilters onRefresh={loadTasks} />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {/* Фильтр Общие / Личные — ToggleButtonGroup как у Список/Рабочее поле */}
                        <ToggleButtonGroup
                            value={taskTypeFilter}
                            onChange={handleTaskTypeChange}
                            size="small"
                        >
                            <ToggleButton value="shared">
                                <People sx={{ mr: 0.5, fontSize: 18 }} />
                                Общие
                            </ToggleButton>
                            <ToggleButton value="personal">
                                <PersonOutline sx={{ mr: 0.5, fontSize: 18 }} />
                                Личные
                            </ToggleButton>
                        </ToggleButtonGroup>

                        {/* Список / Рабочее поле */}
                        {!isMobile && (
                            <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                                <ToggleButton value="list">
                                    <ViewList sx={{ mr: 0.5, fontSize: 18 }} />
                                    Список
                                </ToggleButton>
                                <ToggleButton value="canvas">
                                    <DashboardIcon sx={{ mr: 0.5, fontSize: 18 }} />
                                    Рабочее поле
                                </ToggleButton>
                            </ToggleButtonGroup>
                        )}
                    </Box>
                </Box>

                <Box sx={{ flexGrow: 1, overflow: 'auto', mt: 2 }}>
                    {viewMode === 'list' ? <TaskList onRefresh={loadTasks} /> : <TaskCanvas onRefresh={loadTasks} />}
                </Box>

                <Fab color="primary" aria-label="add" sx={{ position: 'fixed', bottom: 16, right: 16 }} onClick={() => setCreateModalOpen(true)}>
                    <Add />
                </Fab>

                <CreateTaskModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onSuccess={loadTasks} />
                <TaskModal onRefresh={loadTasks} />
            </Box>
        </MainLayout>
    );
};

export default DashboardPage;
