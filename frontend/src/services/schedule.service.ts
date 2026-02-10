import api from './api';
import {
    ScheduleVersion,
    SchoolClass,
    Teacher,
    Subject,
    Room,
    Workload,
    ScheduleLesson,
    ScheduleConflict,
    Substitution,
    AutoGenerateOptions,
    AutoGenerateResult,
    ValidationResult,
    ScheduleStatistics,
    LessonActionResult,
    PlacementCheckResult,
    ScheduleVersionResponse,
} from '../types/schedule';

// API Service
export const scheduleService = {
    // === Версии расписания ===

    async getVersions(): Promise<{ versions: ScheduleVersion[] }> {
        const response = await api.get('/schedule/versions');
        return response.data;
    },

    async getVersion(id: number): Promise<ScheduleVersionResponse> {
        const response = await api.get(`/schedule/versions/${id}`);
        return response.data;
    },

    async createVersion(data: Partial<ScheduleVersion>): Promise<ScheduleVersion> {
        const response = await api.post('/schedule/versions', data);
        return response.data;
    },

    async updateVersion(id: number, data: Partial<ScheduleVersion>): Promise<ScheduleVersion> {
        const response = await api.put(`/schedule/versions/${id}`, data);
        return response.data;
    },

    async deleteVersion(id: number): Promise<void> {
        await api.delete(`/schedule/versions/${id}`);
    },

    async copyVersion(id: number, name: string): Promise<ScheduleVersion> {
        const response = await api.post(`/schedule/versions/${id}/copy`, { name });
        return response.data;
    },

    async activateVersion(id: number): Promise<ScheduleVersion> {
        const response = await api.post(`/schedule/versions/${id}/activate`);
        return response.data;
    },

    async publishVersion(id: number): Promise<ScheduleVersion> {
        const response = await api.post(`/schedule/versions/${id}/publish`);
        return response.data;
    },

    // === Уроки ===

    async createLesson(data: {
        workloadId: number;
        dayOfWeek: number;
        lessonNumber: number;
        weekType?: string;
        roomId?: number;
    }): Promise<LessonActionResult> {
        const response = await api.post('/schedule/lessons', data);
        return response.data;
    },

    async moveLesson(
        id: number,
        data: {
            dayOfWeek: number;
            lessonNumber: number;
            weekType?: string;
            roomId?: number;
        },
    ): Promise<LessonActionResult> {
        const response = await api.put(`/schedule/lessons/${id}/move`, data);
        return response.data;
    },

    async updateLesson(id: number, data: Partial<ScheduleLesson>): Promise<ScheduleLesson> {
        const response = await api.put(`/schedule/lessons/${id}`, data);
        return response.data;
    },

    async deleteLesson(id: number): Promise<void> {
        await api.delete(`/schedule/lessons/${id}`);
    },

    async toggleLessonLock(id: number): Promise<ScheduleLesson> {
        const response = await api.post(`/schedule/lessons/${id}/toggle-lock`);
        return response.data;
    },

    async checkPlacement(data: {
        workloadId: number;
        dayOfWeek: number;
        lessonNumber: number;
        weekType?: string;
        roomId?: number;
    }): Promise<PlacementCheckResult> {
        const response = await api.post('/schedule/lessons/check-placement', data);
        return response.data;
    },

    async getAvailableSlots(workloadId: number): Promise<{
        slots: { dayOfWeek: number; lessonNumber: number; quality: number }[];
    }> {
        const response = await api.get(`/schedule/lessons/available-slots/${workloadId}`);
        return response.data;
    },

    // === Автоматическое составление ===

    async autoGenerate(versionId: number, options: AutoGenerateOptions): Promise<AutoGenerateResult> {
        const response = await api.post(`/schedule/versions/${versionId}/auto-generate`, options);
        return response.data;
    },

    // === Валидация ===

    async validateVersion(versionId: number): Promise<ValidationResult> {
        const response = await api.post(`/schedule/versions/${versionId}/validate`);
        return response.data;
    },

    // === Замены ===

    async getSubstitutions(date: string): Promise<{
        date: string;
        originalLessons: ScheduleLesson[];
        substitutions: Substitution[];
    }> {
        const response = await api.get(`/schedule/substitutions?date=${date}`);
        return response.data;
    },

    async createSubstitution(data: {
        lessonId: number;
        date: string;
        newTeacherId?: number;
        newRoomId?: number;
        newSubjectId?: number;
        isCancelled?: boolean;
        reason?: string;
    }): Promise<Substitution> {
        const response = await api.post('/schedule/substitutions', data);
        return response.data;
    },

    async getAvailableTeachers(lessonId: number, date: string): Promise<{
        availableTeachers: {
            id: number;
            name: string;
            subjects: string[];
            currentLoad: number;
            suitability: number;
        }[];
    }> {
        const response = await api.get(`/schedule/substitutions/available-teachers`, {
            params: { lessonId, date },
        });
        return response.data;
    },

    // === Экспорт ===

    async exportSchedule(
        versionId: number,
        options: {
            format: 'xlsx' | 'pdf' | 'html';
            view: 'class' | 'teacher' | 'room';
            ids?: number[];
            weekType?: 'odd' | 'even';
        },
    ): Promise<Blob> {
        const response = await api.get(`/schedule/versions/${versionId}/export`, {
            params: options,
            responseType: 'blob',
        });
        return response.data;
    },

    // === Справочники ===

    async getClasses(): Promise<{ classes: SchoolClass[] }> {
        const response = await api.get('/schedule/classes');
        return response.data;
    },

    async getTeachers(): Promise<{ teachers: Teacher[] }> {
        const response = await api.get('/schedule/teachers');
        return response.data;
    },

    async getSubjects(): Promise<{ subjects: Subject[] }> {
        const response = await api.get('/schedule/subjects');
        return response.data;
    },

    async getRooms(): Promise<{ rooms: Room[] }> {
        const response = await api.get('/schedule/rooms');
        return response.data;
    },

    // === Нагрузка ===

    async getWorkloads(versionId: number): Promise<{ workloads: Workload[] }> {
        const response = await api.get(`/schedule/versions/${versionId}/workloads`);
        return response.data;
    },

    async createWorkload(versionId: number, data: Partial<Workload>): Promise<Workload> {
        const response = await api.post(`/schedule/versions/${versionId}/workloads`, data);
        return response.data;
    },

    async updateWorkload(id: number, data: Partial<Workload>): Promise<Workload> {
        const response = await api.put(`/schedule/workloads/${id}`, data);
        return response.data;
    },

    async deleteWorkload(id: number): Promise<void> {
        await api.delete(`/schedule/workloads/${id}`);
    },

    // === Статистика ===

    async getStatistics(versionId: number): Promise<ScheduleStatistics> {
        const response = await api.get(`/schedule/versions/${versionId}/statistics`);
        return response.data;
    },
};

export default scheduleService;
