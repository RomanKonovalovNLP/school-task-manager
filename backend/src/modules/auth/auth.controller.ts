import {
    Controller,
    Post,
    Body,
    Get,
    Delete,
    Param,
    ParseIntPipe,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /**
     * Вход для гостя
     * POST /auth/login
     */
    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.loginGuest(loginDto);
    }

    /**
     * Вход для администратора
     * POST /auth/admin-login
     */
    @Post('admin-login')
    async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
        return this.authService.loginAdmin(adminLoginDto);
    }

    /**
     * Проверка текущей сессии
     * GET /auth/session
     */
    @UseGuards(SchoolAuthGuard)
    @Get('session')
    async checkSession(@CurrentUser() user: any) {
        return {
            message: 'Сессия активна',
            user,
        };
    }

    /**
     * Справочник сотрудников (id + ФИО) для назначения задач и мероприятий персонально.
     * Доступен всем пользователям школы: например, классный руководитель назначает
     * задачу конкретному учителю. Служебные поля не отдаются.
     */
    @UseGuards(SchoolAuthGuard)
    @Get('users/directory')
    async usersDirectory(@CurrentUser() user: any) {
        return this.authService.getUsersDirectory(user.schoolId);
    }

    // ===== Подтверждение входа новых пользователей (только админ) =====

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Get('users')
    async allUsers(@CurrentUser() user: any) {
        return this.authService.getAllUsers(user.schoolId);
    }

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Post('users/:id/revoke')
    async revokeUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.authService.revokeUser(id, user.schoolId);
    }

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Get('pending-users')
    async pendingUsers(@CurrentUser() user: any) {
        return this.authService.getPendingUsers(user.schoolId);
    }

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Get('pending-users/count')
    async pendingCount(@CurrentUser() user: any) {
        return this.authService.getPendingCount(user.schoolId);
    }

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Post('pending-users/:id/approve')
    async approveUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.authService.approveUser(id, user.schoolId);
    }

    @UseGuards(SchoolAuthGuard, AdminGuard)
    @Delete('pending-users/:id')
    async rejectUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.authService.rejectUser(id, user.schoolId);
    }

    /**
     * Выход из системы
     * DELETE /auth/logout
     */
    @UseGuards(SchoolAuthGuard)
    @Delete('logout')
    async logout(@CurrentUser() user: any) {
        return this.authService.logout(user.sessionToken);
    }
}
