import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User, AuthState } from '../../types';

const initialState: AuthState = {
    user: null,
    sessionToken: localStorage.getItem('sessionToken'),
    isAuthenticated: !!localStorage.getItem('sessionToken'),
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
        loginSuccess: (state, action: PayloadAction<User>) => {
            state.loading = false;
            state.isAuthenticated = true;
            state.user = action.payload;
            state.sessionToken = action.payload.sessionToken;
            state.error = null;
            // Сохранить токен и пользователя в localStorage
            localStorage.setItem('sessionToken', action.payload.sessionToken);
            localStorage.setItem('user', JSON.stringify(action.payload));
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
            // Очистить localStorage
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('user');
        },
        restoreSession: (state, action: PayloadAction<User>) => {
            state.isAuthenticated = true;
            state.user = action.payload;
            state.sessionToken = action.payload.sessionToken;
        },
        // ИСПРАВЛЕНИЕ: Обновляем категории в state И в localStorage
        updateUserCategories: (state, action: PayloadAction<string[]>) => {
            if (state.user) {
                state.user.categories = action.payload;
                // ВАЖНО: Обновляем localStorage
                localStorage.setItem('user', JSON.stringify(state.user));
            }
        },
    },
});

export const {
    loginStart,
    loginSuccess,
    loginFailure,
    logout,
    restoreSession,
    updateUserCategories
} = authSlice.actions;

export default authSlice.reducer;