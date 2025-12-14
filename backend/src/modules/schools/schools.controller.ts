import { Controller, Post, Get } from '@nestjs/common';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
    constructor(private readonly schoolsService: SchoolsService) { }

    /**
     * Создать тестовые данные
     * POST /schools/seed
     */
    @Post('seed')
    async seedData() {
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

