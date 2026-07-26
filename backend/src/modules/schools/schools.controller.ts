import { Controller, Post, Get, ForbiddenException, UseGuards } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('schools')
export class SchoolsController {
    constructor(private readonly schoolsService: SchoolsService) { }

    /**
     * Создать тестовые данные
     * POST /schools/seed
     * M12: Добавлен guard + проверка NODE_ENV
     */
    @Post('seed')
    @UseGuards(SchoolAuthGuard, AdminGuard)
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
     * ИСПРАВЛЕНО: эндпоинт был полностью открыт и отдавал имена администраторов
     * любому анониму — теперь только для авторизованного администратора
     */
    @Get('info')
    @UseGuards(SchoolAuthGuard, AdminGuard)
    async getInfo() {
        return this.schoolsService.getSchoolInfo();
    }
}
