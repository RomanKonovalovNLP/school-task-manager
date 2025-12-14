import {
    Controller,
    Get,
    Post,
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

    /**
     * Получить все категории школы
     * GET /filters
     */
    @Get()
    findAll(@CurrentUser() user: any) {
        return this.filtersService.findAll(user.schoolId);
    }

    /**
     * Создать новую категорию (только админы)
     * POST /filters
     */
    @Post()
    @UseGuards(AdminGuard)
    create(
        @Body('categoryName') categoryName: string,
        @CurrentUser() user: any,
    ) {
        return this.filtersService.create(user.schoolId, categoryName);
    }

    /**
     * Удалить категорию (только админы)
     * DELETE /filters/:id
     */
    @Delete(':id')
    @UseGuards(AdminGuard)
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.filtersService.remove(id, user.schoolId);
    }

    /**
     * Создать тестовые категории
     * POST /filters/seed
     */
    @Post('seed')
    @UseGuards(AdminGuard)
    seedCategories(@CurrentUser() user: any) {
        return this.filtersService.seedCategories(user.schoolId);
    }
}
