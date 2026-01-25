import api from './api';
import { User } from '../types';

interface LoginDto {
    fullName: string;
    schoolPassword: string;
}

interface AdminLoginDto {
    fullName: string;
    adminPassword: string;
    schoolPassword: string;
}

export const authService = {
    /**
     * Вход гостя
     */
    async loginGuest(data: LoginDto): Promise<User> {
        const response = await api.post<User>('/auth/login', data);
        return response.data;
    },

    /**
     * Вход админа
     */
    async loginAdmin(data: AdminLoginDto): Promise<User> {
        const response = await api.post<User>('/auth/admin-login', data);
        return response.data;
    },

    /**
     * Проверка сессии
     */
    async checkSession(): Promise<{ user: User }> {
        const response = await api.get('/auth/session');
        return response.data;
    },

    /**
     * Выход
     */
    async logout(): Promise<void> {
        await api.delete('/auth/logout');
    },
};