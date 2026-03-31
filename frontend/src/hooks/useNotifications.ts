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
            if ('Notification' in window && window.Notification.permission === 'granted') {
                new window.Notification('Новая задача!', {
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
        requestNotificationPermission,
    };
};