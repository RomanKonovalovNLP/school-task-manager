import { Event } from '../services/events.service';

/** Конец суток указанной даты */
const endOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

/**
 * Момент, после которого мероприятие считается завершённым.
 *
 * ВАЖНО: у мероприятия «на весь день» время начала — 00:00, поэтому прямое
 * сравнение startDate с текущим моментом помечало сегодняшнее мероприятие
 * как прошедшее сразу после полуночи. Для «весь день» и для мероприятий без
 * времени окончания границей считается конец соответствующего дня.
 */
export const getEventEnd = (event: Event): Date => {
    const start = new Date(event.startDate || event.eventDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    if (event.allDay) return endOfDay(end || start);
    if (!end) return endOfDay(start);

    return end;
};

/**
 * Цветовая политика мероприятий — та же шкала, что у задач:
 * зелёный — завершено, красный — сегодня/идёт, оранжевый — на днях,
 * синий — впереди. Чтобы взгляд читал списки задач и мероприятий одинаково.
 */
export const EVENT_COLORS = {
    done: '#2E7D32',     // прошло — зелёный, как выполненная задача
    now: '#FF4444',      // сегодня или идёт сейчас — красный
    soon: '#FFA500',     // в ближайшие 3 дня — оранжевый
    later: '#1E88E5',    // позже — синий
} as const;

export interface EventStatus {
    start: Date;
    end: Date;
    isPast: boolean;
    isToday: boolean;
    isOngoing: boolean;
}

/** Статус мероприятия относительно текущего момента */
export const getEventStatus = (event: Event, now: Date = new Date()): EventStatus => {
    const start = new Date(event.startDate || event.eventDate);
    const end = getEventEnd(event);

    const isPast = end.getTime() < now.getTime();
    const isToday =
        start.toDateString() === now.toDateString() ||
        (now.getTime() >= start.getTime() && now.getTime() <= end.getTime());
    // «Идёт сейчас» показываем только для мероприятий с конкретным временем
    const isOngoing =
        !event.allDay &&
        !!event.endDate &&
        start.getTime() <= now.getTime() &&
        end.getTime() >= now.getTime();

    return { start, end, isPast, isToday, isOngoing };
};

/** Цвет мероприятия по той же логике, что и приоритет задачи */
export const getEventColor = (event: Event, now: Date = new Date()): string => {
    const { start, isPast, isToday, isOngoing } = getEventStatus(event, now);

    if (isPast) return EVENT_COLORS.done;
    if (isOngoing || isToday) return EVENT_COLORS.now;

    const hoursLeft = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursLeft <= 24) return EVENT_COLORS.now;
    if (hoursLeft <= 72) return EVENT_COLORS.soon;
    return EVENT_COLORS.later;
};

/** Подпись статуса мероприятия для чипа */
export const getEventStatusLabel = (event: Event, now: Date = new Date()): string => {
    const { start, isPast, isToday, isOngoing } = getEventStatus(event, now);
    if (isPast) return 'Завершено';
    if (isOngoing) return 'Идёт сейчас';
    if (isToday) return 'Сегодня';

    const hoursLeft = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursLeft <= 24) return 'Завтра';
    if (hoursLeft <= 72) return 'На днях';
    return 'Предстоит';
};
