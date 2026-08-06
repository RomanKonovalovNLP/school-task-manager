import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Menu,
    MenuItem,
    Divider,
    ListItemIcon,
    FormControlLabel,
    Switch,
    IconButton,
    Tooltip,
    useTheme,
    useMediaQuery,
} from '@mui/material';
import { Add, Folder, FolderOff, Check, DeleteOutline, CreateNewFolder, Checklist, Visibility } from '@mui/icons-material';
import TaskCard from './TaskCard';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { setSelectedTask, removeTask } from '../../store/slices/tasksSlice';
import { tasksService, TaskGroup } from '../../services/tasks.service';
import { Task } from '../../types';
import { isTaskDoneFor } from '../../utils/taskHelpers';
import { useCelebration } from '../celebration/CelebrationProvider';

interface TaskListProps {
    onRefresh: () => void;
}

const TaskList: React.FC<TaskListProps> = ({ onRefresh }) => {
    const { tasks, loading, error, filters } = useAppSelector((state) => state.tasks);
    const { user } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const celebrate = useCelebration();

    // Скрытие выполненных и просроченных задач.
    // Для создателя задачи и админа «выполнена» = отметили все назначенные,
    // для обычного пользователя — достаточно его собственной отметки.
    const visibleTasks = React.useMemo(
        () =>
            tasks.filter((t) => {
                if (filters.hideCompleted && isTaskDoneFor(t, user)) return false;
                if (filters.hideOverdue && t.priority === 'overdue') return false;
                return true;
            }),
        [tasks, filters.hideCompleted, filters.hideOverdue, user],
    );
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

    // Группировка
    const [grouped, setGrouped] = useState(false);
    const [selMode, setSelMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkAnchor, setBulkAnchor] = useState<null | HTMLElement>(null);
    const [groups, setGroups] = useState<TaskGroup[]>([]);
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuTask, setMenuTask] = useState<Task | null>(null);

    const loadGroups = useCallback(async () => {
        try { setGroups(await tasksService.getGroups()); } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadGroups(); }, [loadGroups]);

    const toggleSel = (id: number) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const exitSel = () => { setSelMode(false); setSelected(new Set()); };
    const bulkDelete = async () => {
        if (!selected.size || !window.confirm(`Удалить выбранные задачи (${selected.size})?`)) return;
        for (const id of Array.from(selected)) { try { await tasksService.delete(id); dispatch(removeTask(id)); } catch { /* ignore */ } }
        exitSel();
    };
    const bulkViewed = async () => {
        for (const id of Array.from(selected)) { try { await tasksService.markAsViewed(id); } catch { /* ignore */ } }
        setSnackbar({ open: true, message: 'Отмечено просмотренным', severity: 'success' }); exitSel(); onRefresh();
    };
    const bulkAssignGroup = async (groupId: number) => {
        for (const id of Array.from(selected)) { try { await tasksService.addTaskToGroup(groupId, id); } catch { /* ignore */ } }
        setBulkAnchor(null); await loadGroups(); exitSel();
    };
    const bulkNewGroup = async () => {
        const name = window.prompt('Название новой группы');
        setBulkAnchor(null);
        if (!name || !name.trim()) return;
        try { const g = await tasksService.createGroup(name.trim()); setGrouped(true); await bulkAssignGroup(g.id); } catch { /* ignore */ }
    };

    // Карты: задача -> группа
    const groupIdByTask = new Map<number, number>();
    const groupNameByTask = new Map<number, string>();
    groups.forEach((g) => g.taskIds.forEach((tid) => { groupIdByTask.set(tid, g.id); groupNameByTask.set(tid, g.name); }));

    // Свайпы на мобильных: влево — удалить, вправо — отметить просмотренным
    const touchStartX = useRef<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.changedTouches[0].clientX; };
    const handleTouchEnd = async (e: React.TouchEvent, taskId: number) => {
        if (touchStartX.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (deltaX < -80) {
            handleDeleteClick(taskId);
        } else if (deltaX > 80) {
            try {
                await tasksService.markAsViewed(taskId);
                setSnackbar({ open: true, message: 'Отмечено как просмотренное', severity: 'success' });
                onRefresh();
            } catch {
                setSnackbar({ open: true, message: 'Не удалось отметить', severity: 'error' });
            }
        }
    };

    const handleTaskClick = (taskId: number) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) dispatch(setSelectedTask(task));
    };

    const handleDeleteClick = (taskId: number) => { setTaskToDelete(taskId); setDeleteDialogOpen(true); };

    // Быстрое добавление задачи в режим «Сегодня»
    const handleAddToToday = async (task: Task) => {
        try {
            const res = await tasksService.addToTodayFocus(task.id);
            setSnackbar({
                open: true,
                message: res.alreadyAuto
                    ? (res.message || 'Задача уже в плане на сегодня')
                    : 'Задача добавлена в план на сегодня',
                severity: 'success',
            });
        } catch {
            setSnackbar({ open: true, message: 'Не удалось добавить в план на сегодня', severity: 'error' });
        }
    };

    // Отметить выполнение прямо с карточки, не открывая задачу
    const handleToggleComplete = async (task: Task) => {
        try {
            const res = await tasksService.toggleCompletion(task.id);
            if (res.completed) {
                celebrate({ variant: 'complete', message: 'Задача успешно выполнена' });
            }
            onRefresh();
        } catch {
            setSnackbar({ open: true, message: 'Не удалось изменить статус задачи', severity: 'error' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete) {
            try {
                await tasksService.delete(taskToDelete);
                dispatch(removeTask(taskToDelete));
                setDeleteDialogOpen(false);
                setTaskToDelete(null);
            } catch (error: any) {
                setSnackbar({ open: true, message: error.response?.data?.message || 'Ошибка при удалении задачи', severity: 'error' });
            }
        }
    };

    // ---- Группы ----
    const openGroupMenu = (e: React.MouseEvent<HTMLElement>, task: Task) => {
        e.stopPropagation();
        setMenuTask(task);
        setMenuAnchor(e.currentTarget);
    };
    const closeGroupMenu = () => { setMenuAnchor(null); setMenuTask(null); };

    const assignToGroup = async (groupId: number) => {
        if (!menuTask) return;
        try { await tasksService.addTaskToGroup(groupId, menuTask.id); await loadGroups(); }
        catch { setSnackbar({ open: true, message: 'Не удалось добавить в группу', severity: 'error' }); }
        finally { closeGroupMenu(); }
    };

    const ungroupTask = async () => {
        if (!menuTask) return;
        try { await tasksService.removeTaskFromGroup(menuTask.id); await loadGroups(); }
        catch { setSnackbar({ open: true, message: 'Не удалось разгруппировать', severity: 'error' }); }
        finally { closeGroupMenu(); }
    };

    const createGroupAndAssign = async () => {
        const name = window.prompt('Название новой группы');
        if (!name || !name.trim()) { closeGroupMenu(); return; }
        try {
            const g = await tasksService.createGroup(name.trim());
            if (menuTask) await tasksService.addTaskToGroup(g.id, menuTask.id);
            setGrouped(true);
            await loadGroups();
        } catch { setSnackbar({ open: true, message: 'Не удалось создать группу', severity: 'error' }); }
        finally { closeGroupMenu(); }
    };

    const createEmptyGroup = async () => {
        const name = window.prompt('Название новой группы');
        if (!name || !name.trim()) return;
        try { await tasksService.createGroup(name.trim()); await loadGroups(); }
        catch { setSnackbar({ open: true, message: 'Не удалось создать группу', severity: 'error' }); }
    };

    const deleteGroup = async (id: number, name: string) => {
        if (!window.confirm(`Удалить группу «${name}»? Задачи останутся, только разгруппируются.`)) return;
        try { await tasksService.deleteGroup(id); await loadGroups(); }
        catch { setSnackbar({ open: true, message: 'Не удалось удалить группу', severity: 'error' }); }
    };

    const renderGrid = (list: Task[]) => (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2, alignItems: 'stretch' }}>
            {list.map((task) => (
                <Box
                    key={task.id}
                    sx={{ height: '100%' }}
                    onTouchStart={isMobile ? handleTouchStart : undefined}
                    onTouchEnd={isMobile ? (e) => handleTouchEnd(e, task.id) : undefined}
                >
                    <TaskCard
                        task={task}
                        onClick={() => handleTaskClick(task.id)}
                        onDelete={() => handleDeleteClick(task.id)}
                        onGroupClick={(e) => openGroupMenu(e, task)}
                        onAddToToday={() => handleAddToToday(task)}
                        onToggleComplete={() => handleToggleComplete(task)}
                        groupName={groupNameByTask.get(task.id)}
                        selectable={selMode}
                        selected={selected.has(task.id)}
                        onSelectToggle={() => toggleSel(task.id)}
                    />
                </Box>
            ))}
        </Box>
    );

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><CircularProgress /></Box>;
    }
    if (error) {
        return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
    }
    if (tasks.length === 0) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><Typography variant="h6" color="text.secondary">Нет задач</Typography></Box>;
    }
    if (visibleTasks.length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: 1 }}>
                <Typography variant="h6" color="text.secondary">Все задачи скрыты фильтрами</Typography>
                <Typography variant="body2" color="text.secondary">Снимите галочки «Скрыть выполненные» или «Скрыть просроченные»</Typography>
            </Box>
        );
    }

    const ungroupedTasks = visibleTasks.filter((t) => !groupIdByTask.has(t.id));

    return (
        <>
            {/* Панель группировки */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <FormControlLabel
                    control={<Switch size="small" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />}
                    label="Группировать"
                />
                {grouped && (
                    <Button size="small" startIcon={<CreateNewFolder />} onClick={createEmptyGroup}>Новая группа</Button>
                )}
                <Button size="small" startIcon={<Checklist />} variant={selMode ? 'contained' : 'text'} onClick={() => (selMode ? exitSel() : setSelMode(true))}>
                    {selMode ? 'Готово' : 'Выбрать'}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                {isMobile && !selMode && (
                    <Typography variant="caption" color="text.secondary">Свайп: влево — удалить, вправо — просмотрено</Typography>
                )}
            </Box>

            {selMode && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover', flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Выбрано: {selected.size}</Typography>
                    <Button size="small" onClick={() => setSelected(new Set(visibleTasks.map((t) => t.id)))}>Все</Button>
                    <Button size="small" color="error" startIcon={<DeleteOutline />} disabled={!selected.size} onClick={bulkDelete}>Удалить</Button>
                    <Button size="small" startIcon={<Folder />} disabled={!selected.size} onClick={(e) => setBulkAnchor(e.currentTarget)}>В группу</Button>
                    <Button size="small" startIcon={<Visibility />} disabled={!selected.size} onClick={bulkViewed}>Просмотрено</Button>
                </Box>
            )}

            <Menu anchorEl={bulkAnchor} open={Boolean(bulkAnchor)} onClose={() => setBulkAnchor(null)}>
                {groups.length === 0 && <MenuItem disabled>Групп пока нет</MenuItem>}
                {groups.map((g) => (
                    <MenuItem key={g.id} onClick={() => bulkAssignGroup(g.id)}>
                        <ListItemIcon><Folder fontSize="small" /></ListItemIcon>{g.name}
                    </MenuItem>
                ))}
                <Divider />
                <MenuItem onClick={bulkNewGroup}><ListItemIcon><CreateNewFolder fontSize="small" /></ListItemIcon>Новая группа…</MenuItem>
            </Menu>

            {!grouped ? (
                renderGrid(visibleTasks)
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {groups.map((g) => {
                        const groupTasks = visibleTasks.filter((t) => groupIdByTask.get(t.id) === g.id);
                        return (
                            <Box key={g.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Folder color="primary" fontSize="small" />
                                    <Typography variant="h6">{g.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">({groupTasks.length})</Typography>
                                    <Tooltip title="Удалить группу">
                                        <IconButton size="small" color="error" onClick={() => deleteGroup(g.id, g.name)}><DeleteOutline fontSize="small" /></IconButton>
                                    </Tooltip>
                                </Box>
                                {groupTasks.length === 0
                                    ? <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>Нет задач. Добавьте через значок папки на карточке.</Typography>
                                    : renderGrid(groupTasks)}
                            </Box>
                        );
                    })}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <FolderOff color="disabled" fontSize="small" />
                            <Typography variant="h6">Без группы</Typography>
                            <Typography variant="body2" color="text.secondary">({ungroupedTasks.length})</Typography>
                        </Box>
                        {ungroupedTasks.length === 0
                            ? <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>Все задачи распределены по группам.</Typography>
                            : renderGrid(ungroupedTasks)}
                    </Box>
                </Box>
            )}

            {/* Меню назначения группы */}
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeGroupMenu}>
                {groups.length === 0 && (
                    <MenuItem disabled>Групп пока нет</MenuItem>
                )}
                {groups.map((g) => {
                    const current = menuTask ? groupIdByTask.get(menuTask.id) === g.id : false;
                    return (
                        <MenuItem key={g.id} onClick={() => assignToGroup(g.id)}>
                            <ListItemIcon>{current ? <Check fontSize="small" /> : <Folder fontSize="small" />}</ListItemIcon>
                            {g.name}
                        </MenuItem>
                    );
                })}
                <Divider />
                <MenuItem onClick={createGroupAndAssign}>
                    <ListItemIcon><CreateNewFolder fontSize="small" /></ListItemIcon>
                    Новая группа…
                </MenuItem>
                {menuTask && groupIdByTask.has(menuTask.id) && (
                    <MenuItem onClick={ungroupTask}>
                        <ListItemIcon><FolderOff fontSize="small" /></ListItemIcon>
                        Убрать из группы
                    </MenuItem>
                )}
            </Menu>

            {/* Диалог подтверждения удаления */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Подтверждение удаления</DialogTitle>
                <DialogContent>Вы уверены, что хотите удалить эту задачу?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Удалить</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar((p) => ({ ...p, open: false }))} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default TaskList;
