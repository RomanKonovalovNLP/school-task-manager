import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
    OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: number;
        schoolId: number;
        fullName: string;
        isAdmin: boolean;
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
    implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationsGateway.name);

    // Map: schoolId -> Set<socketId>
    private schoolRooms = new Map<number, Set<string>>();

    // Map: socketId -> user data
    private connectedUsers = new Map<string, any>();

    // Флаг инициализации
    private isServerInitialized = false;

    constructor(private notificationsService: NotificationsService) { }

    afterInit(server: Server) {
        this.isServerInitialized = true;
        this.logger.log('WebSocket Gateway initialized successfully');
    }

    async handleConnection(client: AuthenticatedSocket) {
        try {
            this.logger.log(`Client attempting to connect: ${client.id}`);

            const token =
                client.handshake.auth.token ||
                client.handshake.headers.authorization;

            if (!token) {
                this.logger.warn('No token provided, disconnecting client');
                client.disconnect();
                return;
            }

            const user = await this.notificationsService.validateUserToken(token);

            if (!user) {
                this.logger.warn('Invalid token, disconnecting client');
                client.disconnect();
                return;
            }

            client.user = user;
            this.connectedUsers.set(client.id, user);

            // Добавляем в комнату школы
            const schoolRoom = `school_${user.schoolId}`;
            client.join(schoolRoom);

            // Добавляем в комнаты категорий
            if (user.categories && Array.isArray(user.categories)) {
                user.categories.forEach((category) => {
                    const categoryRoom = `school_${user.schoolId}_category_${category}`;
                    client.join(categoryRoom);
                });
            }

            // Персональная комната пользователя (для адресных уведомлений)
            client.join(`school_${user.schoolId}_user_${user.fullName}`);

            // Обновляем Map комнат
            if (!this.schoolRooms.has(user.schoolId)) {
                this.schoolRooms.set(user.schoolId, new Set());
            }
            this.schoolRooms.get(user.schoolId)!.add(client.id);

            this.logger.log(
                `User ${user.fullName} connected to school ${user.schoolId} with categories: ${user.categories?.join(', ')}`,
            );

            // Отправляем накопленные уведомления: непрочитанные + прочитанные за сутки,
            // чтобы после перезагрузки страницы важное не исчезало из списка
            const recentNotifications =
                await this.notificationsService.getRecentNotifications(
                    user.schoolId,
                    user.fullName,
                    user.categories,
                );

            client.emit('unread_notifications', recentNotifications);
        } catch (error) {
            this.logger.error('Connection error:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: AuthenticatedSocket) {
        const user = this.connectedUsers.get(client.id);

        if (user) {
            const schoolSockets = this.schoolRooms.get(user.schoolId);
            if (schoolSockets) {
                schoolSockets.delete(client.id);
                if (schoolSockets.size === 0) {
                    this.schoolRooms.delete(user.schoolId);
                }
            }

            this.logger.log(
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

        // ИСПРАВЛЕНО (#5): передаём schoolId и категории — без них проверка
        // принадлежности в markAsRead не выполнялась, и любой пользователь
        // мог пометить прочитанным чужое уведомление по ID.
        try {
            await this.notificationsService.markAsRead(
                notificationId,
                client.user.schoolId,
                client.user.fullName,
                client.user.categories,
            );
            client.emit('notification_read', { notificationId });
        } catch (error) {
            this.logger.warn(
                `mark_as_read denied for user ${client.user.fullName}, notification ${notificationId}`,
            );
        }
    }

    @SubscribeMessage('mark_all_as_read')
    async handleMarkAllAsRead(@ConnectedSocket() client: AuthenticatedSocket) {
        if (!client.user) return;

        await this.notificationsService.markAllAsRead(
            client.user.schoolId,
            client.user.fullName,
            client.user.categories,
        );

        client.emit('all_notifications_read');
    }

    /**
     * ИСПРАВЛЕНИЕ: Отправка ОДНОГО уведомления каждому пользователю
     * (даже если он в нескольких категориях)
     */
    sendUniqueNotificationToCategories(
        schoolId: number,
        categories: string[],
        notification: any,
    ) {
        if (!this.isServerInitialized || !this.server) {
            this.logger.warn('Server not initialized yet, skipping real-time notification');
            return;
        }

        try {
            // Собираем уникальных пользователей, которым нужно отправить уведомление
            const notifiedSocketIds = new Set<string>();
            const schoolSockets = this.schoolRooms.get(schoolId);

            if (!schoolSockets) {
                this.logger.log(`No users online for school ${schoolId}`);
                return;
            }

            // Проходим по всем подключенным пользователям школы
            for (const socketId of schoolSockets) {
                // Если уже отправили этому сокету - пропускаем
                if (notifiedSocketIds.has(socketId)) {
                    continue;
                }

                const user = this.connectedUsers.get(socketId);
                if (!user || !user.categories) continue;

                // Проверяем, есть ли пересечение категорий пользователя с категориями задачи
                const hasMatchingCategory = user.categories.some(
                    (userCat: string) => categories.includes(userCat)
                );

                if (hasMatchingCategory) {
                    // Отправляем ОДНО уведомление этому пользователю
                    this.server.to(socketId).emit('new_notification', notification);
                    notifiedSocketIds.add(socketId);
                    this.logger.log(`Sent unique notification to user ${user.fullName}`);
                }
            }

            this.logger.log(
                `Sent notifications to ${notifiedSocketIds.size} unique users for school ${schoolId}`
            );
        } catch (error) {
            this.logger.error('Error sending notification to categories:', error);
        }
    }

    /**
     * Старый метод - оставляем для совместимости, но теперь вызывает новый
     */
    async sendNotificationToCategories(
        schoolId: number,
        categories: string[],
        notification: any,
    ) {
        this.sendUniqueNotificationToCategories(schoolId, categories, notification);
    }

    /** Адресные уведомления конкретным пользователям (по ФИО) через их персональные комнаты. */
    sendNotificationToUsers(schoolId: number, users: string[], notification: any) {
        if (!this.isServerInitialized || !this.server) return;
        try {
            users.forEach((u) => {
                this.server.to(`school_${schoolId}_user_${u}`).emit('new_notification', notification);
            });
        } catch (error) {
            this.logger.error('Error sending notification to users:', error);
        }
    }

    /**
     * Отправка уведомления конкретному пользователю
     */
    async sendNotificationToUser(
        userId: number,
        schoolId: number,
        notification: any,
    ) {
        if (!this.isServerInitialized || !this.server) {
            this.logger.warn('Server not initialized yet, skipping notification');
            return;
        }

        try {
            const schoolSockets = this.schoolRooms.get(schoolId);

            if (!schoolSockets) {
                this.logger.log(`No sockets found for school ${schoolId}`);
                return;
            }

            for (const socketId of schoolSockets) {
                const user = this.connectedUsers.get(socketId);
                if (user && user.id === userId) {
                    this.server.to(socketId).emit('new_notification', notification);
                    this.logger.log(`Sent notification to user ${userId} via socket ${socketId}`);
                    return;
                }
            }

            this.logger.log(`User ${userId} not found in school ${schoolId}`);
        } catch (error) {
            this.logger.error('Error sending notification to user:', error);
        }
    }

    /**
     * ИСПРАВЛЕНО (#4): может ли пользователь видеть задачу.
     * Личные — только создателю; categoryOnly — админам, создателю
     * и пользователям с пересекающимися категориями.
     */
    private canUserSeeTask(user: any, task: any): boolean {
        if (task?.isPersonal) {
            return user.fullName === task.creatorName;
        }
        if (task?.categoryOnly) {
            if (user.isAdmin || user.fullName === task.creatorName) return true;
            const taskCategories: string[] = task.assigneeCategories || [];
            return (user.categories || []).some((c: string) => taskCategories.includes(c));
        }
        return true;
    }

    /**
     * ИСПРАВЛЕНО (#4): личные и categoryOnly-задачи не рассылаются
     * всей школе — только тем, кто имеет право их видеть.
     */
    private emitTaskEventFiltered(schoolId: number, eventName: string, task: any) {
        // Обычные задачи — всей школе, как раньше
        if (!task?.isPersonal && !task?.categoryOnly) {
            this.server.to(`school_${schoolId}`).emit(eventName, task);
            return;
        }

        const schoolSockets = this.schoolRooms.get(schoolId);
        if (!schoolSockets) return;

        for (const socketId of schoolSockets) {
            const user = this.connectedUsers.get(socketId);
            if (user && this.canUserSeeTask(user, task)) {
                this.server.to(socketId).emit(eventName, task);
            }
        }
    }

    /**
     * Broadcast изменений в таске (для синхронизации canvas)
     */
    broadcastTaskUpdate(schoolId: number, taskUpdate: any) {
        if (!this.isServerInitialized || !this.server) {
            this.logger.warn('Server not initialized, skipping task update broadcast');
            return;
        }

        try {
            this.emitTaskEventFiltered(schoolId, 'task_updated', taskUpdate);
            this.logger.log(`Broadcasted task update to school ${schoolId}`);
        } catch (error) {
            this.logger.error('Error broadcasting task update:', error);
        }
    }

    /**
     * Broadcast удаления таски
     */
    broadcastTaskDelete(schoolId: number, taskId: number) {
        if (!this.isServerInitialized || !this.server) {
            this.logger.warn('Server not initialized, skipping task delete broadcast');
            return;
        }

        try {
            this.server.to(`school_${schoolId}`).emit('task_deleted', { taskId });
            this.logger.log(`Broadcasted task delete to school ${schoolId}, taskId: ${taskId}`);
        } catch (error) {
            this.logger.error('Error broadcasting task delete:', error);
        }
    }

    /**
     * Broadcast создания новой таски
     */
    broadcastTaskCreated(schoolId: number, task: any) {
        if (!this.isServerInitialized || !this.server) {
            this.logger.warn('Server not initialized, skipping task created broadcast');
            return;
        }

        try {
            this.emitTaskEventFiltered(schoolId, 'task_created', task);
            this.logger.log(`Broadcasted task created to school ${schoolId}`);
        } catch (error) {
            this.logger.error('Error broadcasting task created:', error);
        }
    }
}
