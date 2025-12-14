import {
    Controller,
    Post,
    Body,
    Get,
    Delete,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
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
     * Выход из системы
     * DELETE /auth/logout
     */
    @UseGuards(SchoolAuthGuard)
    @Delete('logout')
    async logout(@CurrentUser() user: any) {
        return this.authService.logout(user.sessionToken);
    }
}
