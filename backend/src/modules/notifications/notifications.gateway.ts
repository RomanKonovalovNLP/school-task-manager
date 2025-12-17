import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: number;
        schoolId: number;
        fullName: string;
        categories: string[];
    };
}

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3001',
        credentials: true,
    },
    namespace: '/notifications',
})
export class NotificationsGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Map: schoolId -> Set<socketId>
    private schoolRooms = new Map<number, Set<string>>();

    // Map: socketId -> user data
    private connectedUsers = new Map<string, any>();

    constructor(private notificationsService: NotificationsService) { }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            console.log(`Client attempting to connect: ${client.id}`);

            // Извлекаем токен из handshake
            const token =
                client.handshake.auth.token ||
                client.handshake.headers.authorization;

            if (!token) {
                console.log('No token provided, disconnecting client');
                client.disconnect();
                return;
            }

            // Валидируем токен и получаем данные пользователя
            const user = await this.notificationsService.validateUserToken(token);

            if (!user) {
                console.log('Invalid token, disconnecting client');
                client.disconnect();
                return;
            }

            // Сохраняем данные пользователя
            client.user = user;
            this.connectedUsers.set(client.id, user);

            // Добавляем в комнату школы
            const schoolRoom = `school_${user.schoolId}`;
            client.join(schoolRoom);

            // Обновляем Map комнат
            if (!this.schoolRooms.has(user.schoolId)) {
                this.schoolRooms.set(user.schoolId, new Set());
            }
            this.schoolRooms.get(user.schoolId)!.add(client.id);

            console.log(
                `User ${user.fullName} connected to school ${user.schoolId}`,
            );

            // Отправляем накопленные уведомления
            const unreadNotifications =
                await this.notificationsService.getUnreadNotifications(
                    user.id,
                    user.schoolId,
                    user.categories,
                );

            client.emit('unread_notifications', unreadNotifications);
        } catch (error) {
            console.error('Connection error:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        const user = this.connectedUsers.get(client.id);

        if (user) {
            // Удаляем из комнаты школы
            const schoolSockets = this.schoolRooms.get(user.schoolId);
            if (schoolSockets) {
                schoolSockets.delete(client.id);
                if (schoolSockets.size === 0) {
                    this.schoolRooms.delete(user.schoolId);
                }
            }

            console.log(
                `User ${user.fullName} disconnected from school ${user.schoolId}`,
            );
        }

        this.connectedUsers.delete(client.id);
    }

    @SubscribeMessage('mark_as_read')
    async handleMarkAsRead(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() notificationId: number,
    ) {
        if (!client.user) return;

        await this.notificationsService.markAsRead(notificationId, client.user.id);

        client.emit('notification_read', { notificationId });
    }

    @SubscribeMessage('mark_all_as_read')
    async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
        if (!client.user) return;

        await this.notificationsService.markAllAsRead(
            client.user.id,
            client.user.schoolId,
            client.user.categories,
        );

        client.emit('all_notifications_read');
    }

    /**
     * Отправка уведомления всем пользователям школы с определенными категориями
     */
    async sendNotificationToCategories(
        schoolId: number,
        categories: string[],
        notification: any,
    ) {
        const schoolSockets = this.schoolRooms.get(schoolId);

        if (!schoolSockets || schoolSockets.size === 0) {
            return; // никто не онлайн
        }

        // Фильтруем сокеты пользователей с нужными категориями
        schoolSockets.forEach((socketId) => {
            const socket = this.server.sockets.sockets.get(
                socketId,
            ) as AuthenticatedSocket;

            if (!socket || !socket.user) return;

            // Проверяем, есть ли у пользователя хотя бы одна из категорий
            const hasMatchingCategory = socket.user.categories.some((cat) =>
                categories.includes(cat),
            );

            if (hasMatchingCategory) {
                socket.emit('new_notification', notification);
            }
        });
    }

    /**
     * Отправка уведомления конкретному пользователю
     */
    async sendNotificationToUser(
        userId: number,
        schoolId: number,
        notification: any,
    ) {
        const schoolSockets = this.schoolRooms.get(schoolId);

        if (!schoolSockets) return;

        schoolSockets.forEach((socketId) => {
            const socket = this.server.sockets.sockets.get(
                socketId,
            ) as AuthenticatedSocket;

            if (socket && socket.user && socket.user.id === userId) {
                socket.emit('new_notification', notification);
            }
        });
    }

    /**
     * Broadcast изменений в таске (для синхронизации canvas)
     */
    broadcastTaskUpdate(schoolId: number, taskUpdate: any) {
        this.server.to(`school_${schoolId}`).emit('task_updated', taskUpdate);
    }

    /**
     * Broadcast удаления таски
     */
    broadcastTaskDelete(schoolId: number, taskId: number) {
        this.server.to(`school_${schoolId}`).emit('task_deleted', { taskId });
    }

    /**
     * Broadcast создания новой таски
     */
    broadcastTaskCreated(schoolId: number, task: any) {
        this.server.to(`school_${schoolId}`).emit('task_created', task);
    }
}