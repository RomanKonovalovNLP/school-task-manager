import { Controller, Post, Get, ForbiddenException } from '@nestjs/common';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
    constructor(private readonly schoolsService: SchoolsService) { }

    /**
     * Создать тестовые данные
     * POST /schools/seed
     * ИСПРАВЛЕНО: Добавлена проверка NODE_ENV - недоступно в production
     */
    @Post('seed')
    async seedData() {
        // Проверяем что мы не в production
        if (process.env.NODE_ENV === 'production') {
            throw new ForbiddenException(
                'Создание тестовых данных недоступно в production окружении'
            );
        }

        return this.schoolsService.seedTestData();
    }

    /**
     * Получить информацию о школе
     * GET /schools/info
     */
    @Get('info')
    async getInfo() {
        return this.schoolsService.getSchoolInfo();
    }
}
