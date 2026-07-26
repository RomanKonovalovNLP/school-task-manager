import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { School } from './entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';

@Injectable()
export class SchoolsService {
    constructor(
        @InjectRepository(School)
        private schoolRepository: Repository<School>,
        @InjectRepository(Admin)
        private adminRepository: Repository<Admin>,
    ) { }

    /**
     * Создание тестовых данных для разработки
     */
    async seedTestData() {
        // Проверить, есть ли уже данные
        const existingSchool = await this.schoolRepository.findOne({
            where: {},
        });

        if (existingSchool) {
            return {
                message: 'Тестовые данные уже существуют',
                instruction: 'Используйте существующие данные для входа',
            };
        }

        // Создать школу
        const schoolPasswordHash = await bcrypt.hash('school123', 10);
        const school = this.schoolRepository.create({
            name: 'Школа №1 г. Москва',
            passwordHash: schoolPasswordHash,
        });
        await this.schoolRepository.save(school);

        // Создать первого админа
        const admin1PasswordHash = await bcrypt.hash('admin123', 10);
        const admin1 = this.adminRepository.create({
            schoolId: school.id,
            fullName: 'Иванов Иван Иванович',
            passwordHash: admin1PasswordHash,
        });
        await this.adminRepository.save(admin1);

        // Создать второго админа
        const admin2PasswordHash = await bcrypt.hash('admin456', 10);
        const admin2 = this.adminRepository.create({
            schoolId: school.id,
            fullName: 'Петрова Мария Сергеевна',
            passwordHash: admin2PasswordHash,
        });
        await this.adminRepository.save(admin2);

        return {
            message: 'Тестовые данные успешно созданы! 🎉',
            school: {
                name: school.name,
                password: 'school123',
            },
            admins: [
                {
                    fullName: admin1.fullName,
                    password: 'admin123',
                },
                {
                    fullName: admin2.fullName,
                    password: 'admin456',
                },
            ],
            guestExample: {
                fullName: 'Любое ФИО (например: Сидоров Петр)',
                schoolPassword: 'school123',
            },
            instructions: {
                guestLogin: 'POST /auth/login с { fullName, schoolPassword }',
                adminLogin:
                    'POST /auth/admin-login с { fullName, adminPassword, schoolPassword }',
            },
        };
    }

    /**
     * Получить информацию о школе
     */
    async getSchoolInfo() {
        const school = await this.schoolRepository.findOne({
            where: {},
            relations: ['admins'],
        });

        if (!school) {
            return {
                message: 'Школа не найдена. Создайте тестовые данные: POST /schools/seed',
            };
        }

        return {
            schoolName: school.name,
            adminsCount: school.admins?.length || 0,
            adminNames: school.admins?.map((a) => a.fullName) || [],
        };
    }
}