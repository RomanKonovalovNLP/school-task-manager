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

    async copyVersion(id: number, name: string, type?: string): Promise<ScheduleVersion> {
        const response = await api.post(`/schedule/versions/${id}/copy`, { name, type });
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

    async unpublishVersion(id: number): Promise<ScheduleVersion> {
        const response = await api.post(`/schedule/versions/${id}/unpublish`);
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
        newDayOfWeek?: number;
        newLessonNumber?: number;
        newWeekType?: string;
        isCancelled?: boolean;
        reason?: string;
    }): Promise<Substitution> {
        const response = await api.post('/schedule/substitutions', data);
        return response.data;
    },

    async getSubstitutionsByVersion(versionId: number): Promise<Substitution[]> {
        const response = await api.get('/schedule/substitutions/by-version', { params: { versionId } });
        return response.data;
    },

    async deleteSubstitution(id: number): Promise<void> {
        await api.delete(`/schedule/substitutions/${id}`);
    },

    async getAvailableForSlot(
        lessonId: number,
        targetDayOfWeek?: number,
        targetLessonNumber?: number,
        date?: string,
    ): Promise<{
        availableTeachers: { id: number; name: string; subjects: string[]; currentLoad: number; suitability: number }[];
        availableRooms: { id: number; name: string; capacity: number; type: string }[];
    }> {
        const response = await api.get('/schedule/substitutions/available', {
            params: { lessonId, targetDayOfWeek, targetLessonNumber, date },
        });
        return response.data;
    },

    async exportSubstitutions(versionId: number): Promise<Blob> {
        const response = await api.get('/schedule/substitutions/export', {
            params: { versionId },
            responseType: 'blob',
        });
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
            view: 'class' | 'teacher' | 'room' | 'master';
            ids?: number[];
            weekType?: 'odd' | 'even';
            paper?: 'a4' | 'a5';
            date?: string;
        },
    ): Promise<Blob> {
        const response = await api.get(`/schedule/versions/${versionId}/export`, {
            params: options,
            responseType: 'blob',
        });
        return response.data;
    },

    // === Справочники ===

    // --- Классы ---
    async getClasses(): Promise<{ classes: SchoolClass[] }> {
        const response = await api.get('/schedule/classes');
        return response.data;
    },

    async createClass(data: Partial<SchoolClass>): Promise<SchoolClass> {
        const response = await api.post('/schedule/classes', data);
        return response.data;
    },

    async updateClass(id: number, data: Partial<SchoolClass>): Promise<SchoolClass> {
        const response = await api.put(`/schedule/classes/${id}`, data);
        return response.data;
    },

    async deleteClass(id: number): Promise<void> {
        await api.delete(`/schedule/classes/${id}`);
    },

    async addClassGroup(classId: number, name: string, studentsCount?: number): Promise<any> {
        const response = await api.post(`/schedule/classes/${classId}/groups`, { name, studentsCount });
        return response.data;
    },

    // --- Учителя ---
    async getTeachers(): Promise<{ teachers: Teacher[] }> {
        const response = await api.get('/schedule/teachers');
        return response.data;
    },

    async createTeacher(data: Partial<Teacher> & { subjectIds?: number[] }): Promise<Teacher> {
        const response = await api.post('/schedule/teachers', data);
        return response.data;
    },

    async updateTeacher(id: number, data: Partial<Teacher> & { subjectIds?: number[] }): Promise<Teacher> {
        const response = await api.put(`/schedule/teachers/${id}`, data);
        return response.data;
    },

    async deleteTeacher(id: number): Promise<void> {
        await api.delete(`/schedule/teachers/${id}`);
    },

    // --- Предметы ---
    async getSubjects(): Promise<{ subjects: Subject[] }> {
        const response = await api.get('/schedule/subjects');
        return response.data;
    },

    async createSubject(data: Partial<Subject>): Promise<Subject> {
        const response = await api.post('/schedule/subjects', data);
        return response.data;
    },

    async updateSubject(id: number, data: Partial<Subject>): Promise<Subject> {
        const response = await api.put(`/schedule/subjects/${id}`, data);
        return response.data;
    },

    async deleteSubject(id: number): Promise<void> {
        await api.delete(`/schedule/subjects/${id}`);
    },

    // --- Кабинеты ---
    async getRooms(): Promise<{ rooms: Room[] }> {
        const response = await api.get('/schedule/rooms');
        return response.data;
    },

    async createRoom(data: Partial<Room>): Promise<Room> {
        const response = await api.post('/schedule/rooms', data);
        return response.data;
    },

    async updateRoom(id: number, data: Partial<Room>): Promise<Room> {
        const response = await api.put(`/schedule/rooms/${id}`, data);
        return response.data;
    },

    async deleteRoom(id: number): Promise<void> {
        await api.delete(`/schedule/rooms/${id}`);
    },

    // === Нагрузка ===

    async getWorkloads(versionId: number): Promise<{ workloads: Workload[] }> {
        const response = await api.get(`/schedule/workloads/version/${versionId}`);
        return response.data;
    },

    async createWorkload(versionId: number, data: Partial<Workload>): Promise<Workload> {
        const response = await api.post(`/schedule/workloads/version/${versionId}`, data);
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

    // === Подгруппы ===

    async removeClassGroup(groupId: number): Promise<void> {
        await api.delete(`/schedule/classes/groups/${groupId}`);
    },

    // === Расписание звонков ===

    async getBellSchedules(): Promise<any> {
        const response = await api.get('/schedule/bell-schedules');
        return response.data;
    },

    async createBellSchedule(data: any): Promise<any> {
        const response = await api.post('/schedule/bell-schedules', data);
        return response.data;
    },

    async updateBellSchedule(id: number, data: any): Promise<any> {
        const response = await api.put(`/schedule/bell-schedules/${id}`, data);
        return response.data;
    },

    async deleteBellSchedule(id: number): Promise<void> {
        await api.delete(`/schedule/bell-schedules/${id}`);
    },

    // === Предпочтения учителей ===

    async getTeacherAvailability(teacherId: number): Promise<any> {
        const response = await api.get(`/schedule/teachers/${teacherId}/availability`);
        return response.data;
    },

    async setTeacherAvailability(teacherId: number, data: any): Promise<any> {
        const response = await api.post(`/schedule/teachers/${teacherId}/availability`, data);
        return response.data;
    },

    // === Календарь (расписание на период) ===

    async getCalendarDays(versionId: number): Promise<any[]> {
        const response = await api.get(`/schedule/versions/${versionId}/calendar`);
        return response.data;
    },

    async getCalendarWeek(versionId: number, weekStart: string): Promise<any[]> {
        const response = await api.get(`/schedule/versions/${versionId}/calendar/week?start=${weekStart}`);
        return response.data;
    },

    async generateCalendar(versionId: number, startDate: string, endDate: string): Promise<any[]> {
        const response = await api.post(`/schedule/versions/${versionId}/calendar/generate`, { startDate, endDate });
        return response.data;
    },

    async updateCalendarDay(versionId: number, date: string, dayType: string, maxLessons?: number, note?: string): Promise<any> {
        const response = await api.put(`/schedule/versions/${versionId}/calendar/day`, { date, dayType, maxLessons, note });
        return response.data;
    },

    async getCalendarStats(versionId: number): Promise<any> {
        const response = await api.get(`/schedule/versions/${versionId}/calendar/stats`);
        return response.data;
    },
};

export default scheduleService;
