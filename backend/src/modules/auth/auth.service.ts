import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { School } from '../schools/entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';
import { UserSession } from './entities/user-session.entity';
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
    ) { }

    /**
     * Вход для гостя (обычного пользователя)
     */
    async loginGuest(loginDto: LoginDto) {
        // Найти школу по паролю
        const schools = await this.schoolRepository.find();
        let school: School | null = null;

        // Проверяем пароль для каждой школы (в реальности школа может быть одна)
        for (const s of schools) {
            const isMatch = await bcrypt.compare(
                loginDto.schoolPassword,
                s.passwordHash,
            );
            if (isMatch) {
                school = s;
                break;
            }
        }

        if (!school) {
            throw new UnauthorizedException('Неверный пароль школы');
        }

        // Проверить, есть ли уже активная сессия для этого пользователя
        const existingSession = await this.sessionRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: loginDto.fullName,
            },
        });

        // Если есть - обновим токен
        if (existingSession) {
            existingSession.sessionToken = this.generateSessionToken();
            existingSession.lastActive = new Date();
            await this.sessionRepository.save(existingSession);

            return {
                sessionToken: existingSession.sessionToken,
                fullName: existingSession.fullName,
                schoolId: school.id,
                schoolName: school.name,
                isAdmin: false,
            };
        }

        // Создать новую сессию
        const sessionToken = this.generateSessionToken();
        const session = this.sessionRepository.create({
            schoolId: school.id,
            fullName: loginDto.fullName,
            sessionToken,
            isAdmin: false,
        });

        await this.sessionRepository.save(session);

        return {
            sessionToken,
            fullName: loginDto.fullName,
            schoolId: school.id,
            schoolName: school.name,
            isAdmin: false,
        };
    }

    /**
     * Вход для администратора
     */
    async loginAdmin(adminLoginDto: AdminLoginDto) {
        // Найти школу по паролю
        const schools = await this.schoolRepository.find();
        let school: School | null = null;

        for (const s of schools) {
            const isMatch = await bcrypt.compare(
                adminLoginDto.schoolPassword,
                s.passwordHash,
            );
            if (isMatch) {
                school = s;
                break;
            }
        }

        if (!school) {
            throw new UnauthorizedException('Неверный пароль школы');
        }

        // Найти админа
        const admin = await this.adminRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: adminLoginDto.fullName,
            },
        });

        if (!admin) {
            throw new UnauthorizedException(
                'Администратор с таким ФИО не найден',
            );
        }

        // Проверить пароль админа
        const isPasswordValid = await bcrypt.compare(
            adminLoginDto.adminPassword,
            admin.passwordHash,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Неверный пароль администратора');
        }

        // Проверить существующую сессию
        const existingSession = await this.sessionRepository.findOne({
            where: {
                schoolId: school.id,
                fullName: admin.fullName,
            },
        });

        if (existingSession) {
            existingSession.sessionToken = this.generateSessionToken();
            existingSession.lastActive = new Date();
            existingSession.isAdmin = true;
            await this.sessionRepository.save(existingSession);

            return {
                sessionToken: existingSession.sessionToken,
                fullName: existingSession.fullName,
                schoolId: school.id,
                schoolName: school.name,
                isAdmin: true,
            };
        }

        // Создать новую сессию для админа
        const sessionToken = this.generateSessionToken();
        const session = this.sessionRepository.create({
            schoolId: school.id,
            fullName: admin.fullName,
            sessionToken,
            isAdmin: true,
        });

        await this.sessionRepository.save(session);

        return {
            sessionToken,
            fullName: admin.fullName,
            schoolId: school.id,
            schoolName: school.name,
            isAdmin: true,
        };
    }

    /**
     * Проверка валидности сессии
     */
    async validateSession(sessionToken: string) {
        const session = await this.sessionRepository.findOne({
            where: { sessionToken },
            relations: ['school'],
        });

        if (!session) {
            throw new UnauthorizedException('Сессия не найдена или истекла');
        }

        // Обновить время последней активности
        session.lastActive = new Date();
        await this.sessionRepository.save(session);

        return {
            sessionId: session.id,
            fullName: session.fullName,
            schoolId: session.schoolId,
            schoolName: session.school.name,
            isAdmin: session.isAdmin,
            lastActive: session.lastActive,
        };
    }

    /**
     * Выход из системы
     */
    async logout(sessionToken: string) {
        const result = await this.sessionRepository.delete({ sessionToken });

        if (result.affected === 0) {
            throw new UnauthorizedException('Сессия не найдена');
        }

        return { message: 'Выход выполнен успешно' };
    }

    /**
     * Генерация уникального токена сессии
     */
    private generateSessionToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }
}