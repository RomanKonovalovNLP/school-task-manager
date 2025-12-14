import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tasks')
@UseGuards(SchoolAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    /**
     * Создать новую таску
     * POST /tasks
     */
    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
        return this.tasksService.create(createTaskDto, user);
    }

    /**
     * Получить все таски школы
     * GET /tasks
     */
    @Get()
    findAll(@CurrentUser() user: any, @Query() filters: TaskFilterDto) {
        return this.tasksService.findAll(user, filters);
    }

    /**
     * Получить таску по ID
     * GET /tasks/:id
     */
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.findOne(id, user);
    }

    /**
     * Обновить таску
     * PATCH /tasks/:id
     */
    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTaskDto: UpdateTaskDto,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.update(id, updateTaskDto, user);
    }

    /**
     * Удалить таску
     * DELETE /tasks/:id
     */
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.remove(id, user);
    }

    /**
     * Удалить все просроченные таски (только админы)
     * DELETE /tasks/overdue/all
     */
    @Delete('overdue/all')
    @UseGuards(AdminGuard)
    removeOverdue(@CurrentUser() user: any) {
        return this.tasksService.removeOverdue(user);
    }

    /**
     * Отметить таску как просмотренную
     * POST /tasks/:id/view
     */
    @Post(':id/view')
    markAsViewed(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
    ) {
        return this.tasksService.markAsViewed(id, user);
    }

    /**
     * Получить список просмотревших таску
     * GET /tasks/:id/views
     */
    @Get(':id/views')
    getViews(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
        return this.tasksService.getViews(id, user);
    }
}
