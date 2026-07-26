import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from '../../modules/auth/entities/user-session.entity';

@Injectable()
export class SchoolAuthGuard implements CanActivate {
    constructor(
        @InjectRepository(UserSession)
        private sessionRepository: Repository<UserSession>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];

        if (!authHeader) {
            throw new UnauthorizedException('Токен авторизации не предоставлен');
        }

        const sessionToken = authHeader.replace('Bearer ', '');

        if (!sessionToken) {
            throw new UnauthorizedException('Неверный формат токена');
        }

        const session = await this.sessionRepository.findOne({
            where: { sessionToken },
            relations: ['school'],
        });

        if (!session) {
            throw new UnauthorizedException('Недействительный токен');
        }

        // Обновляем время последней активности не чаще раза в 5 минут.
        // ИСПРАВЛЕНО: раньше запись в БД выполнялась на КАЖДЫЙ запрос —
        // лишняя нагрузка при опросе уведомлений и частых обновлениях списков.
        const FIVE_MINUTES = 5 * 60 * 1000;
        const lastActive = session.lastActive ? new Date(session.lastActive).getTime() : 0;
        if (Date.now() - lastActive > FIVE_MINUTES) {
            session.lastActive = new Date();
            await this.sessionRepository.save(session);
        }

        // Прикрепить пользователя к запросу
        request.user = {
            sessionId: session.id,
            schoolId: session.schoolId,
            fullName: session.fullName,
            isAdmin: session.isAdmin,
            sessionToken: session.sessionToken,
        };

        return true;
    }
}