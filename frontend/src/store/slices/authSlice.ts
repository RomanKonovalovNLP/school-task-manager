import { createSlice, PayloadAction, Middleware } from '@reduxjs/toolkit';
import { User, AuthState } from '../../types';

// F26: Не устанавливаем isAuthenticated на основании наличия токена.
// Токен может быть просроченным. Валидация — через checkSession в AppContent.
const initialState: AuthState = {
    user: null,
    sessionToken: localStorage.getItem('sessionToken'),
    isAuthenticated: false,
    loading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        loginStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        // F25: Редьюсер — чистая функция. Побочные эффекты (localStorage) — в middleware.
        loginSuccess: (state, action: PayloadAction<User>) => {
            state.loading = false;
            state.isAuthenticated = true;
            state.user = action.payload;
            state.sessionToken = action.payload.sessionToken;
            state.error = null;
        },
        loginFailure: (state, action: PayloadAction<string>) => {
            state.loading = false;
            state.error = action.payload;
        },
        logout: (state) => {
            state.user = null;
            state.sessionToken = null;
            state.isAuthenticated = false;
            state.error = null;
        },
        restoreSession: (state, action: PayloadAction<User>) => {
            state.isAuthenticated = true;
            state.user = action.payload;
            state.sessionToken = action.payload.sessionToken;
        },
        updateUserCategories: (state, action: PayloadAction<string[]>) => {
            if (state.user) {
                state.user.categories = action.payload;
            }
        },
    },
});

// F25: Middleware для побочных эффектов localStorage (вместо записи в редьюсерах)
export const authLocalStorageMiddleware: Middleware = () => (next) => (action: any) => {
    const result = next(action);

    if (action.type === loginSuccess.type) {
        const user = action.payload as User;
        localStorage.setItem('sessionToken', user.sessionToken);
        localStorage.setItem('user', JSON.stringify(user));
    } else if (action.type === logout.type) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
    } else if (action.type === updateUserCategories.type) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                user.categories = action.payload;
                localStorage.setItem('user', JSON.stringify(user));
            } catch { /* ignore */ }
        }
    }

    return result;
};

export const {
    loginStart,
    loginSuccess,
    loginFailure,
    logout,
    restoreSession,
    updateUserCategories
} = authSlice.actions;

export default authSlice.reducer;
