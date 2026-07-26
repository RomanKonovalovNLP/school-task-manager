import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { School } from '../schools/entities/school.entity';
// ИСПРАВЛЕНИЕ: Правильный путь к Admin entity (в модуле admins)
import { Admin } from '../admins/entities/admin.entity';
import { UserSession } from './entities/user-session.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { FilterCategory } from '../filters/entities/filter-category.entity';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(School)
        private schoolRepository: Repository<School>,
        @InjectRepository(Admin)
        private adminRepository: Repository<Admin>,
        @InjectRepository(UserSession)
        private sessionRepository: Repository<UserSession>,
        @InjectRepository(UserProfile)
        private userProfileRepository: Repository<UserProfile>,
        @InjectRepository(UserCategory)
        private userCategoryRepository: Repository<UserCategory>,
        @InjectRepository(FilterCategory)
        private filterCategoryRepository: Repository<FilterCategory>,
    ) {}

    /**
     * Получить категории пользователя из профиля
     */
    private async getUserCategories(schoolId: number, fullName: string): Promise<string[]> {
        const profile = await this.userProfileRepository.findOne({
            where: { schoolId, fullName },
        });

        if (!profile) {
            return [];
        }

        const userCategories = await this.userCategoryRepository.find({
            where: { userProfileId: profile.id },
            relations: ['category'],
        });

        return userCategories
            .filter(uc => uc.category)
            .map(uc => uc.category.categoryName);
    }

    /**
     * Вход гостя (обычного пользователя)
     */
    async loginGuest(loginDto: LoginDto) {
        // Находим школу по паролю
        const schools = await this.schoolRepository.find();
        let school: School | null = null;

        for (const s of schools) {
            const isMatch = await bcrypt.compare(loginDto.schoolPassword, s.passwordHash);
            if (isMatch) {
                school = s;
                break;
            }
        }

        if (!school) {
            throw new UnauthorizedException('Неверный пароль школы');
        }

        // Подтверждение входа: новый гость требует одобрения администратора (единожды)
        let profile = await this.userProfileRepository.findOne({
            where: { schoolId: school.id, fullName: loginDto.fullName },
        });
        if (!profile) {
            profile = this.userProfileRepository.create({
                schoolId: school.id,
                fullName: loginDto.fullName,
                approved: false,
            } as any) as unknown as UserProfile;
            await this.userProfileRepository.save(profile);
            return {
                pendingApproval: true,
                message: 'Вход отправлен на подтверждение администратору школы. Попробуйте войти позже.',
            } as any;
        }
        if (!(profile as any).approved) {
            return {
                pendingApproval: true,
                message: 'Ваш вход ожидает подтверждения администратором школы.',
            } as any;
        }

        // Создаём или обновляем сессию
        const sessionToken = uuidv4();

        let session = await this.sessionRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: loginDto.fullName,
            },
        });

        if (session) {
            session.sessionToken = sessionToken;
            session.lastActive = new Date();
        } else {
            session = this.sessionRepository.create({
                schoolId: school.id,
                fullName: loginDto.fullName,
                sessionToken,
                isAdmin: false,
            });
        }

        await this.sessionRepository.save(session);

        // ИСПРАВЛЕНИЕ: Получаем категории из профиля пользователя
        const categories = await this.getUserCategories(school.id, loginDto.fullName);

        return {
            sessionId: session.id,
            schoolId: school.id,
            schoolName: school.name,
            fullName: session.fullName,
            isAdmin: false,
            sessionToken,
            categories,
        };
    }

    /**
     * Вход администратора
     */
    async loginAdmin(adminLoginDto: AdminLoginDto) {
        // Находим школу по паролю
        const schools = await this.schoolRepository.find();
        let school: School | null = null;

        for (const s of schools) {
            const isMatch = await bcrypt.compare(adminLoginDto.schoolPassword, s.passwordHash);
            if (isMatch) {
                school = s;
                break;
            }
        }

        if (!school) {
            throw new UnauthorizedException('Неверный пароль школы');
        }

        // Находим администратора
        const admin = await this.adminRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: adminLoginDto.fullName,
            },
        });

        if (!admin) {
            throw new UnauthorizedException('Администратор не найден');
        }

        // Проверяем пароль админа
        const isPasswordValid = await bcrypt.compare(
            adminLoginDto.adminPassword,
            admin.passwordHash,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Неверный пароль администратора');
        }

        // Создаём или обновляем сессию
        const sessionToken = uuidv4();

        let session = await this.sessionRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: adminLoginDto.fullName,
            },
        });

        if (session) {
            session.sessionToken = sessionToken;
            session.isAdmin = true;
            session.lastActive = new Date();
        } else {
            session = this.sessionRepository.create({
                schoolId: school.id,
                fullName: adminLoginDto.fullName,
                sessionToken,
                isAdmin: true,
            });
        }

        await this.sessionRepository.save(session);

        // ИСПРАВЛЕНИЕ: Получаем категории из профиля пользователя
        const categories = await this.getUserCategories(school.id, adminLoginDto.fullName);

        return {
            sessionId: session.id,
            schoolId: school.id,
            schoolName: school.name,
            fullName: session.fullName,
            isAdmin: true,
            sessionToken,
            categories,
        };
    }

    /**
     * Проверка сессии
     */
    async checkSession(sessionToken: string) {
        const session = await this.sessionRepository.findOne({
            where: { sessionToken },
        });

        if (!session) {
            throw new UnauthorizedException('Сессия не найдена');
        }

        const school = await this.schoolRepository.findOne({
            where: { id: session.schoolId },
        });

        // ИСПРАВЛЕНИЕ: Получаем категории из профиля
        const categories = await this.getUserCategories(session.schoolId, session.fullName);

        return {
            user: {
                sessionId: session.id,
                schoolId: session.schoolId,
                schoolName: school?.name,
                fullName: session.fullName,
                isAdmin: session.isAdmin,
                sessionToken: session.sessionToken,
                categories,
            },
        };
    }

    /**
     * Выход из системы
     */
    // ===== Подтверждение входа новых пользователей (админ) =====

    async getPendingUsers(schoolId: number) {
        return this.userProfileRepository.find({
            where: { schoolId, approved: false } as any,
            order: { createdAt: 'ASC' },
        });
    }

    async getAllUsers(schoolId: number) {
        return this.userProfileRepository.find({
            where: { schoolId },
            order: { fullName: 'ASC' },
        });
    }

    /**
     * Справочник сотрудников для назначения задач и мероприятий «персонально».
     * Доступен любому пользователю школы, поэтому отдаём только id и ФИО —
     * без служебных полей (статус подтверждения, даты и т.п.).
     */
    async getUsersDirectory(schoolId: number) {
        const profiles = await this.userProfileRepository.find({
            where: { schoolId, approved: true } as any,
            order: { fullName: 'ASC' },
        });

        return profiles.map((p) => ({ id: p.id, fullName: p.fullName }));
    }

    async revokeUser(id: number, schoolId: number) {
        const p = await this.userProfileRepository.findOne({ where: { id, schoolId } });
        if (!p) throw new NotFoundException('Пользователь не найден');
        (p as any).approved = false;
        await this.userProfileRepository.save(p);

        // ИСПРАВЛЕНО: отзыв доступа не завершал активные сессии — пользователь
        // продолжал работать в приложении, пока сам не выйдет
        await this.sessionRepository.delete({ schoolId, fullName: p.fullName });

        return { success: true };
    }

    async getPendingCount(schoolId: number) {
        const count = await this.userProfileRepository.count({ where: { schoolId, approved: false } as any });
        return { count };
    }

    async approveUser(id: number, schoolId: number) {
        const p = await this.userProfileRepository.findOne({ where: { id, schoolId } });
        if (!p) throw new NotFoundException('Пользователь не найден');
        (p as any).approved = true;
        await this.userProfileRepository.save(p);
        return { success: true };
    }

    async rejectUser(id: number, schoolId: number) {
        const p = await this.userProfileRepository.findOne({ where: { id, schoolId } });
        if (!p) throw new NotFoundException('Пользователь не найден');
        // Сессии отклонённого пользователя тоже завершаем
        await this.sessionRepository.delete({ schoolId, fullName: p.fullName });
        await this.userProfileRepository.remove(p);
        return { success: true };
    }

    async logout(sessionToken: string) {
        const session = await this.sessionRepository.findOne({
            where: { sessionToken },
        });

        if (session) {
            await this.sessionRepository.remove(session);
        }

        return { message: 'Успешный выход' };
    }

    /**
     * Валидация токена (для guards)
     */
    async validateToken(token: string): Promise<any> {
        const session = await this.sessionRepository.findOne({
            where: { sessionToken: token },
        });

        if (!session) {
            return null;
        }

        // Обновляем lastActive
        session.lastActive = new Date();
        await this.sessionRepository.save(session);

        // Получаем категории
        const categories = await this.getUserCategories(session.schoolId, session.fullName);

        return {
            sessionId: session.id,
            schoolId: session.schoolId,
            fullName: session.fullName,
            isAdmin: session.isAdmin,
            sessionToken: session.sessionToken,
            categories,
        };
    }

    /**
     * Cron: ежедневная очистка неактивных сессий (не использовались 30+ дней)
     */
    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async cleanupExpiredSessions() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const result = await this.sessionRepository.delete({
            lastActive: LessThan(cutoff),
        });
        return { deleted: result.affected || 0 };
    }
}
