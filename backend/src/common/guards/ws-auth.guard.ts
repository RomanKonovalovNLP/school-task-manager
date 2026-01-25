import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from '../../modules/auth/entities/user-session.entity';

/**
 * Guard для WebSocket соединений
 * ИСПРАВЛЕНО: Проверяет валидность токена в БД
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
    constructor(
        @InjectRepository(UserSession)
        private userSessionsRepo: Repository<UserSession>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client: Socket = context.switchToWs().getClient();

        // Получаем токен из handshake
        const token =
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization;

        if (!token) {
            throw new WsException('Unauthorized: No token provided');
        }

        // Очищаем токен от префикса Bearer если есть
        const cleanToken = token.replace('Bearer ', '').trim();

        // ИСПРАВЛЕНО: Валидируем токен в БД
        try {
            const session = await this.userSessionsRepo.findOne({
                where: { sessionToken: cleanToken },
            });

            if (!session) {
                throw new WsException('Unauthorized: Invalid token');
            }

            // Проверяем что сессия не истекла (lastActive не старше 24 часов)
            const sessionAge = Date.now() - new Date(session.lastActive).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 часа
            if (sessionAge > maxAge) {
                throw new WsException('Unauthorized: Session expired');
            }

            // Прикрепляем данные пользователя к socket
            (client as any).user = {
                id: session.id,
                schoolId: session.schoolId,
                fullName: session.fullName,
                isAdmin: session.isAdmin,
            };

            return true;
        } catch (error) {
            if (error instanceof WsException) {
                throw error;
            }
            console.error('WsAuthGuard error:', error);
            throw new WsException('Unauthorized: Token validation failed');
        }
    }
}
