import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Отдельный экземпляр axios для супер-админа
const superAdminApi = axios.create({
    baseURL: API_URL,
});

// Добавляем токен к запросам
superAdminApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('superAdminToken');
    if (token) {
        config.headers['x-super-admin-token'] = token;
    }
    return config;
});

// Обработка ошибок
superAdminApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('superAdminToken');
            window.location.href = '/super-admin/login';
        }
        return Promise.reject(error);
    }
);

export interface School {
    id: number;
    name: string;
    adminsCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface SchoolAdmin {
    id: number;
    fullName: string;
    schoolId: number;
    createdAt: string;
}

export interface SystemStats {
    totalSchools: number;
    totalAdmins: number;
}

export const superAdminService = {
    /**
     * Первичная настройка супер-админа
     */
    async setup(setupKey: string, username: string, password: string): Promise<{ message: string }> {
        const response = await superAdminApi.post('/super-admin/setup', {
            setupKey,
            username,
            password,
        });
        return response.data;
    },

    /**
     * Вход супер-админа
     */
    async login(username: string, password: string): Promise<{ token: string; expiresIn: string }> {
        const response = await superAdminApi.post('/super-admin/login', {
            username,
            password,
        });
        
        if (response.data.token) {
            localStorage.setItem('superAdminToken', response.data.token);
        }
        
        return response.data;
    },

    /**
     * Выход
     */
    async logout(): Promise<void> {
        try {
            await superAdminApi.post('/super-admin/logout');
        } finally {
            localStorage.removeItem('superAdminToken');
        }
    },

    /**
     * Проверка авторизации
     */
    isAuthenticated(): boolean {
        return !!localStorage.getItem('superAdminToken');
    },

    /**
     * Получить статистику системы
     */
    async getStats(): Promise<SystemStats> {
        const response = await superAdminApi.get('/super-admin/stats');
        return response.data;
    },

    // ==================== ШКОЛЫ ====================

    /**
     * Получить все школы
     */
    async getSchools(): Promise<School[]> {
        const response = await superAdminApi.get('/super-admin/schools');
        return response.data;
    },

    /**
     * Создать школу
     */
    async createSchool(name: string, password: string): Promise<School> {
        const response = await superAdminApi.post('/super-admin/schools', {
            name,
            password,
        });
        return response.data;
    },

    /**
     * Обновить школу
     */
    async updateSchool(id: number, data: { name?: string; password?: string }): Promise<School> {
        const response = await superAdminApi.put(`/super-admin/schools/${id}`, data);
        return response.data;
    },

    /**
     * Удалить школу
     */
    async deleteSchool(id: number): Promise<{ message: string }> {
        const response = await superAdminApi.delete(`/super-admin/schools/${id}`);
        return response.data;
    },

    // ==================== АДМИНЫ ШКОЛ ====================

    /**
     * Получить админов школы
     */
    async getSchoolAdmins(schoolId: number): Promise<SchoolAdmin[]> {
        const response = await superAdminApi.get(`/super-admin/schools/${schoolId}/admins`);
        return response.data;
    },

    /**
     * Создать админа школы
     */
    async createSchoolAdmin(schoolId: number, fullName: string, password: string): Promise<SchoolAdmin> {
        const response = await superAdminApi.post('/super-admin/admins', {
            schoolId,
            fullName,
            password,
        });
        return response.data;
    },

    /**
     * Обновить админа школы
     */
    async updateSchoolAdmin(
        adminId: number,
        data: { fullName?: string; password?: string }
    ): Promise<SchoolAdmin> {
        const response = await superAdminApi.put(`/super-admin/admins/${adminId}`, data);
        return response.data;
    },

    /**
     * Удалить админа школы
     */
    async deleteSchoolAdmin(adminId: number): Promise<{ message: string }> {
        const response = await superAdminApi.delete(`/super-admin/admins/${adminId}`);
        return response.data;
    },
};
