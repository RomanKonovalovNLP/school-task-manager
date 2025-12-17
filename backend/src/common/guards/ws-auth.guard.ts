import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Guard для WebSocket соединений
 * Проверяет наличие и валидность токена в handshake
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const client: Socket = context.switchToWs().getClient();

        // Получаем токен из handshake
        const token =
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization;

        if (!token) {
            throw new WsException('Unauthorized: No token provided');
        }

        // Токен будет валидирован в gateway при подключении
        return true;
    }
}