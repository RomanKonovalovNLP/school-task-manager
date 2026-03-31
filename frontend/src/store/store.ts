import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import { authLocalStorageMiddleware } from './slices/authSlice';
import tasksReducer from './slices/tasksSlice';
import filtersReducer from './slices/filtersSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        tasks: tasksReducer,
        filters: filtersReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(authLocalStorageMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;