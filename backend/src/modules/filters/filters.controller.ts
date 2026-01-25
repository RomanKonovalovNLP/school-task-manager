import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { FiltersService } from './filters.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('filters')
@UseGuards(SchoolAuthGuard)
export class FiltersController {
    constructor(private readonly filtersService: FiltersService) { }

    // ==================== СТАТИЧЕСКИЕ РОУТЫ (перед динамическими) ====================

    /**
     * Получить категории текущего пользователя по профилю
     * GET /filters/my-categories
     * ИСПРАВЛЕНО: Перемещено ВЫШЕ /filters/:id
     */
    @Get('my-categories')
    async getMyCategories(@CurrentUser() user: any) {
        const categories = await this.filtersService.getUserCategories(
            user.schoolId,
            user.fullName,
        );
        return { categories };
    }

    /**
     * Создать дефолтные категории (только админ)
     * POST /filters/seed
     * ИСПРАВЛЕНО: Добавлен AdminGuard
     */
    @Post('seed')
    @UseGuards(AdminGuard)
    async seed(@CurrentUser() user: any) {
        await this.filtersService.seedCategories(user.schoolId);
        return { success: true, message: 'Дефолтные категории созданы' };
    }

    /**
     * Установить категории пользователя по профилю
     * POST /filters/set-categories
     * Body: { categoryIds: number[] }
     */
    @Post('set-categories')
    async setCategories(
        @CurrentUser() user: any,
        @Body('categoryIds') categoryIds: number[],
    ) {
        await this.filtersService.setUserCategories(
            user.schoolId,
            user.fullName,
            categoryIds,
        );
        return { success: true, message: 'Категории обновлены' };
    }

    // ==================== РОУТ БЕЗ ПАРАМЕТРА ====================

    /**
     * Получить все категории
     * GET /filters
     */
    @Get()
    async findAll(@CurrentUser() user: any) {
        return this.filtersService.findAll(user.schoolId);
    }

    /**
     * Создать категорию (только админ)
     * POST /filters
     * Body: { categoryName: string }
     */
    @Post()
    @UseGuards(AdminGuard)
    async create(
        @CurrentUser() user: any,
        @Body('categoryName') categoryName: string,
    ) {
        return this.filtersService.create(user.schoolId, categoryName, user.isAdmin);
    }

    // ==================== ДИНАМИЧЕСКИЕ РОУТЫ С :id ====================

    /**
     * Обновить категорию (только админ)
     * PUT /filters/:id
     * Body: { categoryName: string }
     */
    @Put(':id')
    @UseGuards(AdminGuard)
    async update(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @Body('categoryName') categoryName: string,
    ) {
        return this.filtersService.update(id, user.schoolId, categoryName, user.isAdmin);
    }

    /**
     * Удалить категорию (только админ)
     * DELETE /filters/:id
     */
    @Delete(':id')
    @UseGuards(AdminGuard)
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        await this.filtersService.remove(id, user.schoolId, user.isAdmin);
        return { success: true, message: 'Категория удалена' };
    }
}
