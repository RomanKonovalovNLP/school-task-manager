import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

// Определяем интерфейс Notification локально
interface Notification {
    id: number;
    schoolId: number;
    recipientCategory: string | null;
    taskId: number | null;
    notificationType: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

/** Заголовок браузерного уведомления по его типу */
const browserNotificationTitle = (type: string): string => {
    if (type === 'weekly_digest') return 'Итоги недели';
    if (type === 'deadline_changed') return 'Изменение срока';
    if (type === 'task_deleted') return 'Задача удалена';
    if (type?.includes('event')) return 'Мероприятие';
    return 'Новая задача';
};

export const useNotifications = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);

    // Получаем sessionToken из Redux
    const { sessionToken } = useSelector((state: RootState) => state.auth);

    // Подключение к WebSocket
    useEffect(() => {
        if (!sessionToken) return;

        const newSocket = io(`${process.env.REACT_APP_WS_URL || 'http://localhost:3000'}/notifications`, {
            auth: { token: sessionToken },
            transports: ['websocket'],
            // F19: Явная настройка переподключения
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 30000,
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        });

        // Получение накопленных уведомлений при подключении
        newSocket.on('unread_notifications', (data: Notification[]) => {
            setNotifications(data);
            setUnreadCount(data.filter((n) => !n.isRead).length);
        });

        // Новое уведомление в реальном времени
        newSocket.on('new_notification', (notification: Notification) => {
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Опционально: показать браузерное уведомление
            // ИСПРАВЛЕНО: заголовок соответствует типу — раньше всё называлось «Новая задача!»
            if ('Notification' in window && window.Notification.permission === 'granted') {
                new window.Notification(browserNotificationTitle(notification.notificationType), {
                    body: notification.message,
                    icon: '/logo192.png',
                });
            }
        });

        // Уведомление прочитано
        newSocket.on('notification_read', ({ notificationId }: { notificationId: number }) => {
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        });

        // Все уведомления прочитаны
        newSocket.on('all_notifications_read', () => {
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [sessionToken]);

    // Отметить уведомление как прочитанное
    const markAsRead = useCallback(
        (notificationId: number) => {
            if (socket) {
                socket.emit('mark_as_read', notificationId);
            }
        },
        [socket]
    );

    // Отметить все уведомления прочитанными
    const markAllAsRead = useCallback(() => {
        if (socket) {
            socket.emit('mark_all_as_read');
        }
    }, [socket]);

    // Запросить разрешение на браузерные уведомления
    const requestNotificationPermission = useCallback(async () => {
        if ('Notification' in window && window.Notification.permission === 'default') {
            await window.Notification.requestPermission();
        }
    }, []);

    return {
        notifications,
        unreadCount,
        isConnected,
        markAsRead,
        markAllAsRead,
        requestNotificationPermission,
    };
};