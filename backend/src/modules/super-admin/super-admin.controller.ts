import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    Req,
    Headers,
} from '@nestjs/common';
import type { Request } from 'express';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import {
    SetupSuperAdminDto,
    LoginSuperAdminDto,
    CreateSchoolDto,
    UpdateSchoolDto,
    CreateSchoolAdminDto,
    UpdateSchoolAdminDto,
} from './dto/super-admin.dto';

@Controller('super-admin')
export class SuperAdminController {
    constructor(private readonly superAdminService: SuperAdminService) {}

    // ==================== PUBLIC ENDPOINTS ====================

    /**
     * Первичная настройка супер-админа
     * POST /super-admin/setup
     */
    @Post('setup')
    setup(@Body() dto: SetupSuperAdminDto) {
        return this.superAdminService.setup(dto);
    }

    /**
     * Вход супер-админа
     * POST /super-admin/login
     */
    @Post('login')
    login(@Body() dto: LoginSuperAdminDto, @Req() req: Request) {
        const ip = this.getClientIp(req);
        return this.superAdminService.login(dto, ip);
    }

    /**
     * Выход
     * POST /super-admin/logout
     */
    @Post('logout')
    logout(@Headers('x-super-admin-token') token: string) {
        return this.superAdminService.logout(token);
    }

    // ==================== PROTECTED ENDPOINTS ====================

    /**
     * Получить статистику системы
     * GET /super-admin/stats
     */
    @Get('stats')
    @UseGuards(SuperAdminGuard)
    getStats() {
        return this.superAdminService.getStats();
    }

    // ==================== SCHOOLS ====================

    /**
     * Получить все школы
     * GET /super-admin/schools
     */
    @Get('schools')
    @UseGuards(SuperAdminGuard)
    getSchools() {
        return this.superAdminService.getSchools();
    }

    /**
     * Создать школу
     * POST /super-admin/schools
     */
    @Post('schools')
    @UseGuards(SuperAdminGuard)
    createSchool(@Body() dto: CreateSchoolDto) {
        return this.superAdminService.createSchool(dto);
    }

    /**
     * Обновить школу
     * PUT /super-admin/schools/:id
     */
    @Put('schools/:id')
    @UseGuards(SuperAdminGuard)
    updateSchool(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateSchoolDto,
    ) {
        return this.superAdminService.updateSchool(id, dto);
    }

    /**
     * Удалить школу
     * DELETE /super-admin/schools/:id
     */
    @Delete('schools/:id')
    @UseGuards(SuperAdminGuard)
    deleteSchool(@Param('id', ParseIntPipe) id: number) {
        return this.superAdminService.deleteSchool(id);
    }

    // ==================== SCHOOL ADMINS ====================

    /**
     * Получить админов школы
     * GET /super-admin/schools/:schoolId/admins
     */
    @Get('schools/:schoolId/admins')
    @UseGuards(SuperAdminGuard)
    getSchoolAdmins(@Param('schoolId', ParseIntPipe) schoolId: number) {
        return this.superAdminService.getSchoolAdmins(schoolId);
    }

    /**
     * Создать админа школы
     * POST /super-admin/admins
     */
    @Post('admins')
    @UseGuards(SuperAdminGuard)
    createSchoolAdmin(@Body() dto: CreateSchoolAdminDto) {
        return this.superAdminService.createSchoolAdmin(dto);
    }

    /**
     * Обновить админа
     * PUT /super-admin/admins/:id
     */
    @Put('admins/:id')
    @UseGuards(SuperAdminGuard)
    updateSchoolAdmin(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateSchoolAdminDto,
    ) {
        return this.superAdminService.updateSchoolAdmin(id, dto);
    }

    /**
     * Удалить админа
     * DELETE /super-admin/admins/:id
     */
    @Delete('admins/:id')
    @UseGuards(SuperAdminGuard)
    deleteSchoolAdmin(@Param('id', ParseIntPipe) id: number) {
        return this.superAdminService.deleteSchoolAdmin(id);
    }

    // ==================== HELPERS ====================

    private getClientIp(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return request.ip || request.socket.remoteAddress || 'unknown';
    }
}
