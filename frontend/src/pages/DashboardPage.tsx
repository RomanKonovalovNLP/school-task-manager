import React, { useEffect, useState } from 'react';
import { Box, Fab, useMediaQuery, useTheme, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Add, ViewList, Dashboard as DashboardIcon } from '@mui/icons-material';
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
    }, [filters]);

    const loadTasks = async () => {
        dispatch(setLoading(true));
        try {
            const tasks = await tasksService.getAll({
                category: filters.category || undefined,
                priority: filters.priority || undefined,
                creatorName: filters.creatorName || undefined,
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
        event: React.MouseEvent<HTMLElement>,
        newMode: 'list' | 'canvas' | null,
    ) => {
        if (newMode !== null) {
            setViewMode(newMode);
        }
    };

    return (
        <MainLayout>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <TaskFilters onRefresh={loadTasks} />

                    {!isMobile && (
                        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
                            <ToggleButton value="list">
                                <ViewList sx={{ mr: 1 }} />
                                Список
                            </ToggleButton>
                            <ToggleButton value="canvas">
                                <DashboardIcon sx={{ mr: 1 }} />
                                Canvas
                            </ToggleButton>
                        </ToggleButtonGroup>
                    )}
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