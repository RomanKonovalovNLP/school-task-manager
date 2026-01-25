export const getPriorityColor = (priority: string): string => {
    switch (priority) {
        case 'urgent':
            return '#FF4444'; // красный
        case 'medium':
            return '#FFA500'; // оранжевый
        case 'low':
            return '#4CAF50'; // зеленый
        case 'overdue':
            return '#9E9E9E'; // серый
        default:
            return '#1976d2';
    }
};

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

export const formatDeadline = (deadline: string): string => {
    const date = new Date(deadline);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (diff < 0) {
        return 'Просрочено';
    } else if (hours < 1) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `Осталось ${minutes} минут`;
    } else if (hours < 24) {
        return `Осталось ${hours} часов`;
    } else if (days < 7) {
        return `Осталось ${days} дней`;
    } else {
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }
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