import api from './api';
import { FilterCategory } from '../types';

export const filtersService = {
    async getAll(): Promise<FilterCategory[]> {
        const response = await api.get<FilterCategory[]>('/filters');
        return response.data;
    },

    async create(categoryName: string): Promise<FilterCategory> {
        const response = await api.post<FilterCategory>('/filters', { categoryName });
        return response.data;
    },

    async update(id: number, categoryName: string): Promise<FilterCategory> {
        const response = await api.put<FilterCategory>(`/filters/${id}`, { categoryName });
        return response.data;
    },

    async delete(id: number): Promise<void> {
        await api.delete(`/filters/${id}`);
    },

    async seedCategories(): Promise<void> {
        await api.post('/filters/seed');
    },

    async getMyCategories(): Promise<{ categories: string[] }> {
        const response = await api.get<{ categories: string[] }>('/filters/my-categories');
        return response.data;
    },

    async setUserCategories(categoryIds: number[]): Promise<void> {
        await api.post('/filters/set-categories', { categoryIds });
    },
};