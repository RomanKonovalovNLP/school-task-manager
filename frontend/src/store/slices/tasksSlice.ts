import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Task } from '../../types';

interface TasksState {
    tasks: Task[];
    loading: boolean;
    error: string | null;
    selectedTask: Task | null;
    filters: {
        category: string[];
        priority: string[];
        creatorName: string;
        // Скрытие задач в списке (считается на клиенте)
        hideCompleted: boolean;
        hideOverdue: boolean;
    };
}

const initialState: TasksState = {
    tasks: [],
    loading: false,
    error: null,
    selectedTask: null,
    filters: {
        category: [],
        priority: [],
        creatorName: '',
        hideCompleted: false,
        hideOverdue: false,
    },
};

const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setTasks: (state, action: PayloadAction<Task[]>) => {
            state.tasks = action.payload;
            state.loading = false;
            state.error = null;
        },
        addTask: (state, action: PayloadAction<Task>) => {
            state.tasks.push(action.payload);
        },
        updateTask: (state, action: PayloadAction<Task>) => {
            const index = state.tasks.findIndex((t) => t.id === action.payload.id);
            if (index !== -1) {
                state.tasks[index] = action.payload;
            }
        },
        removeTask: (state, action: PayloadAction<number>) => {
            state.tasks = state.tasks.filter((t) => t.id !== action.payload);
        },
        setSelectedTask: (state, action: PayloadAction<Task | null>) => {
            state.selectedTask = action.payload;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
            state.loading = false;
        },
        setFilters: (
            state,
            action: PayloadAction<Partial<TasksState['filters']>>,
        ) => {
            state.filters = { ...state.filters, ...action.payload };
        },
        clearFilters: (state) => {
            state.filters = {
                category: [],
                priority: [],
                creatorName: '',
                hideCompleted: false,
                hideOverdue: false,
            };
        },
    },
});

export const {
    setLoading,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    setSelectedTask,
    setError,
    setFilters,
    clearFilters,
} = tasksSlice.actions;

export default tasksSlice.reducer;