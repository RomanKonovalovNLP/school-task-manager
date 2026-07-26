// Зелёный закреплён за выполненными задачами, поэтому «несрочные» —
// спокойный синий: он читается как «информация, спешить некуда»
export const COMPLETED_COLOR = '#2E7D32'; // зелёный — выполнено

export const getPriorityColor = (priority: string): string => {
    switch (priority) {
        case 'urgent':
            return '#FF4444'; // красный — срочно
        case 'medium':
            return '#FFA500'; // оранжевый — средний приоритет
        case 'low':
            return '#1E88E5'; // синий — несрочно
        case 'overdue':
            return '#9E9E9E'; // серый — просрочено
        default:
            return '#1976d2';
    }
};

/**
 * Считается ли задача выполненной для конкретного пользователя.
 * Обычный пользователь — по своей отметке.
 * Создатель задачи и администратор — только когда отметили ВСЕ назначенные.
 */
export const isTaskDoneFor = (
    task: { isCompletedByUser?: boolean; isFullyCompleted?: boolean; creatorName?: string },
    user?: { fullName?: string; isAdmin?: boolean } | null,
): boolean => {
    const isOwnerView = !!user && (!!user.isAdmin || task.creatorName === user.fullName);
    return isOwnerView ? !!task.isFullyCompleted : !!task.isCompletedByUser;
};

/** Цвет подсветки задачи: выполненная — зелёная, остальные — по приоритету */
export const getTaskColor = (
    task: { priority: string; isCompletedByUser?: boolean; isFullyCompleted?: boolean; creatorName?: string },
    user?: { fullName?: string; isAdmin?: boolean } | null,
): string => (isTaskDoneFor(task, user) ? COMPLETED_COLOR : getPriorityColor(task.priority));

export const getPriorityLabel = (priority: string): string => {
    switch (priority) {
        case 'urgent':
            return 'Срочно';
        case 'medium':
            return 'Средний приоритет';
        case 'low':
            return 'Несрочно';
        case 'overdue':
            return 'Просрочено';
        default:
            return 'Неизвестно';
    }
};

/**
 * Русское склонение числительных: 1 час, 2 часа, 5 часов
 */
export const plural = (n: number, one: string, few: string, many: string): string => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
};

const minutesText = (n: number) => `${n} ${plural(n, 'минута', 'минуты', 'минут')}`;
const hoursText = (n: number) => `${n} ${plural(n, 'час', 'часа', 'часов')}`;
const daysText = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

export const formatDeadline = (deadline: string): string => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) {
        return 'Просрочено';
    }

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    // Меньше часа — только минуты
    if (totalHours < 1) {
        return `Осталось ${minutesText(totalMinutes)}`;
    }

    // Меньше суток — часы И минуты, иначе «1 час» вводит в заблуждение при 1 ч 50 мин
    if (totalHours < 24) {
        const minutes = totalMinutes % 60;
        return minutes > 0
            ? `Осталось ${hoursText(totalHours)} ${minutesText(minutes)}`
            : `Осталось ${hoursText(totalHours)}`;
    }

    // Меньше недели — дни и остаток в часах
    if (days < 7) {
        const hours = totalHours % 24;
        return hours > 0 ? `Осталось ${daysText(days)} ${hoursText(hours)}` : `Осталось ${daysText(days)}`;
    }

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

export const formatDateTime = (datetime: string): string => {
    const date = new Date(datetime);
    return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};