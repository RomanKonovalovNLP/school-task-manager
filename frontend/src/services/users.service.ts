import api from './api';

/** Часы по одному предмету за неделю */
export interface SubjectLoad {
    subject: string;
    hours: number;
    classes: string[];
}

export interface UserRow {
    id: number;
    fullName: string;
    approved: boolean;
    createdAt: string;
    isAdmin: boolean;
    /** Категории, выбранные пользователем при входе */
    categories: string[];
    /** Нагрузка из расписания, по предметам */
    load: SubjectLoad[];
    totalHours: number;
    /** Есть ли у пользователя карточка учителя в расписании */
    hasTeacherCard: boolean;
}

export interface UserLesson {
    dayOfWeek: number;
    lessonNumber: number;
    weekType: string;
    subject: string;
    className: string;
    room: string | null;
}

export interface UserCard extends UserRow {
    teacher: {
        id: number;
        shortName: string;
        email: string | null;
        phone: string | null;
        maxLessonsPerDay: number;
        isActive: boolean;
    } | null;
    scheduleVersion: { id: number; name: string } | null;
    lessons: UserLesson[];
    taskStats: {
        assigned: number;
        completed: number;
        onTime: number;
        late: number;
        overdue: number;
        created: number;
        completionRate: number;
    };
}

export const usersService = {
    async getOverview(): Promise<{
        users: UserRow[];
        scheduleVersion: { id: number; name: string } | null;
    }> {
        const response = await api.get('/users/overview');
        return response.data;
    },

    async getCard(id: number): Promise<UserCard> {
        const response = await api.get(`/users/${id}/card`);
        return response.data;
    },
};
