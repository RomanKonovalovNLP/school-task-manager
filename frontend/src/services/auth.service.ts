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
    async loginGuest(data: LoginDto): Promise<any> {
        const response = await api.post('/auth/login', data);
        return response.data;
    },

    // ===== Подтверждение входа (админ) =====
    async getPendingUsers(): Promise<{ id: number; fullName: string; createdAt: string }[]> {
        const response = await api.get('/auth/pending-users');
        return response.data;
    },
    async getAllUsers(): Promise<{ id: number; fullName: string; approved: boolean; createdAt: string }[]> {
        const response = await api.get('/auth/users');
        return response.data;
    },
    /**
     * Справочник сотрудников для поля «Для кого» → «Персонально».
     * Доступен всем пользователям (в отличие от getAllUsers, который только для админов).
     */
    async getUsersDirectory(): Promise<{ id: number; fullName: string }[]> {
        const response = await api.get('/auth/users/directory');
        return response.data;
    },
    async revokeUser(id: number): Promise<void> {
        await api.post(`/auth/users/${id}/revoke`);
    },
    async getPendingCount(): Promise<{ count: number }> {
        const response = await api.get('/auth/pending-users/count');
        return response.data;
    },
    async approveUser(id: number): Promise<void> {
        await api.post(`/auth/pending-users/${id}/approve`);
    },
    async rejectUser(id: number): Promise<void> {
        await api.delete(`/auth/pending-users/${id}`);
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