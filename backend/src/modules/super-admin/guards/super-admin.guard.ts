import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

// Простое in-memory хранилище токенов (в продакшене использовать Redis)
interface TokenData {
    superAdminId: number;
    ip: string;
    expiresAt: Date;
}

export const superAdminTokenStore = new Map<string, TokenData>();

// Очистка устаревших токенов каждые 10 минут
setInterval(() => {
    const now = new Date();
    for (const [token, data] of superAdminTokenStore.entries()) {
        if (data.expiresAt < now) {
            superAdminTokenStore.delete(token);
        }
    }
}, 10 * 60 * 1000);

@Injectable()
export class SuperAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const token = request.headers['x-super-admin-token'] as string;

        if (!token) {
            throw new UnauthorizedException('Требуется авторизация супер-админа');
        }

        const tokenData = superAdminTokenStore.get(token);

        if (!tokenData) {
            throw new UnauthorizedException('Недействительный токен');
        }

        if (tokenData.expiresAt < new Date()) {
            superAdminTokenStore.delete(token);
            throw new UnauthorizedException('Токен истёк');
        }

        // Проверка IP (защита от перехвата токена)
        const clientIp = this.getClientIp(request);
        if (tokenData.ip !== clientIp) {
            superAdminTokenStore.delete(token);
            throw new UnauthorizedException('Токен недействителен для данного IP');
        }

        // Добавляем данные в request для использования в контроллере
        (request as any).superAdminId = tokenData.superAdminId;

        return true;
    }

    private getClientIp(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return request.ip || request.socket.remoteAddress || 'unknown';
    }
}
