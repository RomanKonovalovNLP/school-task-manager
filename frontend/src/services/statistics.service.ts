import api from './api';

export interface Statistics {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    mediumPriorityTasks: number;
    lowPriorityTasks: number;
    tasksByCategory: Record<string, number>;
    tasksByPriority: {
        urgent: number;
        medium: number;
        low: number;
        overdue: number;
    };
    completionRate: number;
    avgCompletionTime: number | null;
}

export interface TrendData {
    date: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
}

export interface CategoryStatistics {
    categories: Array<{
        name: string;
        count: number;
        percentage: number;
    }>;
}

export interface CreatorStatistics {
    creators: Array<{
        name: string;
        count: number;
        percentage: number;
    }>;
}

// НОВОЕ: Статистика по пользователям
export interface UserCompletionStats {
    userId: number;
    fullName: string;
    completedTasksCount: number;
    recentCompletions: Array<{
        taskId: number;
        taskTitle: string;
        completedAt: string;
    }>;
}

export interface UserStatisticsResponse {
    users: UserCompletionStats[];
    summary: {
        totalUsers: number;
        totalCompletions: number;
        avgCompletionsPerUser: number;
    };
}

// НОВОЕ: Детальная статистика по задачам
export interface TaskCompletionStats {
    taskId: number;
    title: string;
    creatorName: string;
    deadline: string;
    priority: string;
    categories: string[];
    completionCount: number;
    expectedCount: number;
    isFullyCompleted: boolean;
    completedBy: Array<{
        fullName: string;
        completedAt: string;
    }>;
    createdAt: string;
}

export interface TasksCompletionResponse {
    tasks: TaskCompletionStats[];
    byPriority: {
        overdue: TaskCompletionStats[];
        urgent: TaskCompletionStats[];
        medium: TaskCompletionStats[];
        low: TaskCompletionStats[];
    };
    summary: {
        totalTasks: number;
        tasksWithCompletions: number;
        tasksWithoutCompletions: number;
        fullyCompletedTasks: number;
        avgCompletionsPerTask: number;
    };
}

// Статистика по неделям (для админов)
export interface WeekStats {
    weekStart: string;
    weekEnd: string;
    label: string;
    isCurrent: boolean;
    createdTasks: number;
    deadlines: number;
    completions: number;
    onTimeCompletions: number;
    lateCompletions: number;
    onTimeRate: number;
    activeUsers: number;
}

export interface WeeklyStatisticsResponse {
    weeks: WeekStats[];
    summary: {
        lastWeekCompletions: number;
        prevWeekCompletions: number;
        deltaCompletions: number;
        lastWeekOnTimeRate: number;
        bestWeekLabel: string | null;
    };
}

export const statisticsService = {
    async getStatistics(startDate?: string, endDate?: string): Promise<Statistics> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const response = await api.get<Statistics>(`/statistics?${params.toString()}`);
        return response.data;
    },

    async getTrends(days: number = 30): Promise<TrendData[]> {
        const response = await api.get<TrendData[]>(`/statistics/trends?days=${days}`);
        return response.data;
    },

    async getCategoryStatistics(): Promise<CategoryStatistics> {
        const response = await api.get<CategoryStatistics>('/statistics/categories');
        return response.data;
    },

    async getCreatorStatistics(): Promise<CreatorStatistics> {
        const response = await api.get<CreatorStatistics>('/statistics/creators');
        return response.data;
    },

    // НОВОЕ: Статистика по пользователям (только для админов)
    async getUserStatistics(): Promise<UserStatisticsResponse> {
        const response = await api.get<UserStatisticsResponse>('/statistics/users');
        return response.data;
    },

    // НОВОЕ: Детальная статистика по задачам (только для админов)
    async getTasksCompletionStatistics(): Promise<TasksCompletionResponse> {
        const response = await api.get<TasksCompletionResponse>('/statistics/tasks-completion');
        return response.data;
    },

    // Статистика по неделям (только для админов)
    async getWeeklyStatistics(weeks: number = 8): Promise<WeeklyStatisticsResponse> {
        const response = await api.get<WeeklyStatisticsResponse>(`/statistics/weekly?weeks=${weeks}`);
        return response.data;
    },
};
