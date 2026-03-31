import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    NotFoundException,
    OnModuleInit,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SuperAdmin } from './entities/super-admin.entity';
import { superAdminTokenStore } from './guards/super-admin.guard';
import { School } from '../schools/entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';
import {
    SetupSuperAdminDto,
    LoginSuperAdminDto,
    CreateSchoolDto,
    UpdateSchoolDto,
    CreateSchoolAdminDto,
    UpdateSchoolAdminDto,
} from './dto/super-admin.dto';

// Защита от brute-force
interface LoginAttempt {
    count: number;
    lockedUntil: Date | null;
}

const loginAttempts = new Map<string, LoginAttempt>();

@Injectable()
export class SuperAdminService implements OnModuleInit {
    private readonly logger = new Logger(SuperAdminService.name);
    private readonly BCRYPT_ROUNDS = 12;
    private readonly TOKEN_EXPIRY_HOURS = 2;
    private readonly MAX_LOGIN_ATTEMPTS = 5;
    private readonly LOCKOUT_MINUTES = 15;

    constructor(
        @InjectRepository(SuperAdmin)
        private readonly superAdminRepository: Repository<SuperAdmin>,
        @InjectRepository(School)
        private readonly schoolRepository: Repository<School>,
        @InjectRepository(Admin)
        private readonly adminRepository: Repository<Admin>,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit() {
        const count = await this.superAdminRepository.count();
        if (count === 0) {
            this.logger.warn('='.repeat(60));
            this.logger.warn('НЕТ СУПЕР-АДМИНОВ В СИСТЕМЕ!');
            this.logger.warn('Для создания первого супер-админа:');
            this.logger.warn('1. Установите SUPER_ADMIN_SETUP_KEY в .env');
            this.logger.warn('2. Перейдите на /super-admin/login');
            this.logger.warn('3. Выберите вкладку "Первая настройка"');
            this.logger.warn('='.repeat(60));
        }
    }

    // ==================== SETUP & AUTH ====================

    async setup(dto: SetupSuperAdminDto): Promise<{ message: string }> {
        const setupKey = this.configService.get<string>('SUPER_ADMIN_SETUP_KEY');

        if (!setupKey || setupKey.length < 32) {
            throw new BadRequestException(
                'SUPER_ADMIN_SETUP_KEY не настроен или слишком короткий (минимум 32 символа)'
            );
        }

        // Проверяем ключ с защитой от timing attacks
        const keyBuffer = Buffer.from(dto.setupKey);
        const expectedBuffer = Buffer.from(setupKey);

        // C8: Проверяем длину ПЕРЕД вызовом timingSafeEqual (он бросает RangeError при разных длинах)
        if (keyBuffer.length !== expectedBuffer.length) {
            throw new UnauthorizedException('Неверный ключ установки');
        }
        if (!crypto.timingSafeEqual(keyBuffer, expectedBuffer)) {
            throw new UnauthorizedException('Неверный ключ установки');
        }

        // Проверяем, есть ли уже супер-админы
        const existingCount = await this.superAdminRepository.count();
        if (existingCount > 0) {
            throw new BadRequestException('Супер-админ уже существует');
        }

        const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

        const superAdmin = this.superAdminRepository.create({
            username: dto.username,
            passwordHash,
        });

        await this.superAdminRepository.save(superAdmin);

        this.logger.log(`Создан супер-админ: ${dto.username}`);

        return { message: 'Супер-админ успешно создан' };
    }

    async login(
        dto: LoginSuperAdminDto,
        clientIp: string,
    ): Promise<{ token: string; expiresIn: string }> {
        // Проверка блокировки
        const attempt = loginAttempts.get(dto.username);
        if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
            const remaining = Math.ceil(
                (attempt.lockedUntil.getTime() - Date.now()) / 60000
            );
            throw new UnauthorizedException(
                `Слишком много попыток. Повторите через ${remaining} мин.`
            );
        }

        const superAdmin = await this.superAdminRepository.findOne({
            where: { username: dto.username, isActive: true },
        });

        if (!superAdmin) {
            this.recordFailedAttempt(dto.username);
            throw new UnauthorizedException('Неверные учётные данные');
        }

        const isValid = await bcrypt.compare(dto.password, superAdmin.passwordHash);

        if (!isValid) {
            this.recordFailedAttempt(dto.username);
            throw new UnauthorizedException('Неверные учётные данные');
        }

        // Сброс попыток при успешном входе
        loginAttempts.delete(dto.username);

        // Генерация токена
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

        superAdminTokenStore.set(token, {
            superAdminId: superAdmin.id,
            ip: clientIp,
            expiresAt,
        });

        // Обновление lastLogin
        superAdmin.lastLogin = new Date();
        await this.superAdminRepository.save(superAdmin);

        this.logger.log(`Супер-админ ${dto.username} вошёл в систему`);

        return {
            token,
            expiresIn: `${this.TOKEN_EXPIRY_HOURS} часа`,
        };
    }

    async logout(token: string): Promise<{ message: string }> {
        superAdminTokenStore.delete(token);
        return { message: 'Выход выполнен' };
    }

    private recordFailedAttempt(username: string): void {
        const attempt = loginAttempts.get(username) || { count: 0, lockedUntil: null };
        attempt.count++;

        if (attempt.count >= this.MAX_LOGIN_ATTEMPTS) {
            attempt.lockedUntil = new Date();
            attempt.lockedUntil.setMinutes(
                attempt.lockedUntil.getMinutes() + this.LOCKOUT_MINUTES
            );
            this.logger.warn(`Супер-админ ${username} заблокирован на ${this.LOCKOUT_MINUTES} мин.`);
        }

        loginAttempts.set(username, attempt);
    }

    // ==================== STATS ====================

    async getStats(): Promise<{ totalSchools: number; totalAdmins: number }> {
        const [totalSchools, totalAdmins] = await Promise.all([
            this.schoolRepository.count(),
            this.adminRepository.count(),
        ]);

        return { totalSchools, totalAdmins };
    }

    // ==================== SCHOOLS ====================

    async getSchools(): Promise<any[]> {
        const schools = await this.schoolRepository.find({
            order: { createdAt: 'DESC' },
        });

        // Подсчёт админов для каждой школы
        const result = await Promise.all(
            schools.map(async (school) => {
                const adminsCount = await this.adminRepository.count({
                    where: { schoolId: school.id },
                });
                return {
                    id: school.id,
                    name: school.name,
                    adminsCount,
                    createdAt: school.createdAt,
                    updatedAt: school.updatedAt,
                };
            })
        );

        return result;
    }

    async createSchool(dto: CreateSchoolDto): Promise<School> {
        const passwordHash = await bcrypt.hash(dto.password, 10);

        const school = this.schoolRepository.create({
            name: dto.name,
            passwordHash,
        });

        return this.schoolRepository.save(school);
    }

    async updateSchool(id: number, dto: UpdateSchoolDto): Promise<School> {
        const school = await this.schoolRepository.findOne({ where: { id } });

        if (!school) {
            throw new NotFoundException('Школа не найдена');
        }

        if (dto.name) {
            school.name = dto.name;
        }

        if (dto.password) {
            school.passwordHash = await bcrypt.hash(dto.password, 10);
        }

        return this.schoolRepository.save(school);
    }

    async deleteSchool(id: number): Promise<{ message: string }> {
        const school = await this.schoolRepository.findOne({ where: { id } });

        if (!school) {
            throw new NotFoundException('Школа не найдена');
        }

        await this.schoolRepository.delete(id);

        return { message: `Школа "${school.name}" удалена` };
    }

    // ==================== SCHOOL ADMINS ====================

    async getSchoolAdmins(schoolId: number): Promise<Admin[]> {
        return this.adminRepository.find({
            where: { schoolId },
            order: { createdAt: 'DESC' },
        });
    }

    async createSchoolAdmin(dto: CreateSchoolAdminDto): Promise<Admin> {
        const school = await this.schoolRepository.findOne({
            where: { id: dto.schoolId },
        });

        if (!school) {
            throw new NotFoundException('Школа не найдена');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const admin = this.adminRepository.create({
            schoolId: dto.schoolId,
            fullName: dto.fullName,
            passwordHash,
        });

        return this.adminRepository.save(admin);
    }

    async updateSchoolAdmin(adminId: number, dto: UpdateSchoolAdminDto): Promise<Admin> {
        const admin = await this.adminRepository.findOne({ where: { id: adminId } });

        if (!admin) {
            throw new NotFoundException('Админ не найден');
        }

        if (dto.fullName) {
            admin.fullName = dto.fullName;
        }

        if (dto.password) {
            admin.passwordHash = await bcrypt.hash(dto.password, 10);
        }

        return this.adminRepository.save(admin);
    }

    async deleteSchoolAdmin(adminId: number): Promise<{ message: string }> {
        const admin = await this.adminRepository.findOne({ where: { id: adminId } });

        if (!admin) {
            throw new NotFoundException('Админ не найден');
        }

        await this.adminRepository.delete(adminId);

        return { message: `Админ "${admin.fullName}" удалён` };
    }
}
