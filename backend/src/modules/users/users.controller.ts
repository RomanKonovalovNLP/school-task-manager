import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Раздел «Пользователи» доступен только администратору школы:
 * здесь видно нагрузку сотрудников и их статистику по задачам.
 */
@Controller('users')
@UseGuards(SchoolAuthGuard, AdminGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    /** Список сотрудников с ролями и часами в неделю */
    @Get('overview')
    async getOverview(@CurrentUser() user: any) {
        return this.usersService.getOverview(user.schoolId);
    }

    /** Карточка одного сотрудника */
    @Get(':id/card')
    async getCard(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.usersService.getCard(user.schoolId, id);
    }
}
