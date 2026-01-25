export interface Task {
    id: number;
    schoolId: number;
    title: string;
    description?: string;
    creatorName: string;
    creatorId: number;
    deadline: string;
    isOverdue: boolean;
    priority: 'urgent' | 'medium' | 'low' | 'overdue';
    createdAt: string;
    updatedAt: string;

    // Relations
    assignees?: TaskAssignee[];
    assigneeCategories?: string[];
    views?: TaskView[];
    attachments?: TaskAttachment[];  // НОВОЕ: Вложения для задач
    viewedByUser?: boolean;
    viewsCount?: number;
    attachmentsCount?: number;  // НОВОЕ
}

export interface TaskView {
    id: number;
    taskId: number;
    viewerName: string;
    viewedAt: string;
}

export interface TaskAssignee {
    id: number;
    taskId: number;
    assigneeCategory: string;
}

// НОВОЕ: Вложения для задач
export interface TaskAttachment {
    id: number;
    taskId: number;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    uploaderName: string;
    uploadedAt: string;
}

export interface TaskPosition {
    id: number;
    taskId: number;
    userSessionId: number;
    positionX: number;
    positionY: number;
    zIndex: number;
    groupId: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface TaskGroup {
    id: number;
    userSessionId: number;
    schoolId: number;
    positionX: number;
    positionY: number;
    createdAt: string;
    updatedAt: string;
}

export interface TaskPositionsResponse {
    positions: TaskPosition[];
    groups: TaskGroup[];
}

export interface Notification {
    id: number;
    schoolId: number;
    recipientCategory: string | null;
    taskId: number | null;
    notificationType: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export interface User {
    id: number;
    sessionId: number;
    schoolId: number;
    schoolName?: string;
    fullName: string;
    isAdmin: boolean;
    sessionToken: string;
    categories: string[];
}

export interface AuthState {
    user: User | null;
    sessionToken: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

export interface School {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface FilterCategory {
    id: number;
    schoolId: number;
    categoryName: string;
    createdAt: string;
}

// DTO Types
export interface CreateTaskDto {
    title: string;
    description?: string;
    deadline: string;
    assigneeCategories: string[];
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    deadline?: string;
    assigneeCategories?: string[];
}
