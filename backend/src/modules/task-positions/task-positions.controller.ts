import {
    Controller,
    Get,
    Patch,
    Post,
    Delete,
    Param,
    Body,
    UseGuards,
    ParseIntPipe,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { TaskPositionsService } from './task-positions.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('task-positions')
@UseGuards(SchoolAuthGuard)
export class TaskPositionsController {
    constructor(private readonly taskPositionsService: TaskPositionsService) {}

    /**
     * Получить все позиции тасок и группы для текущего пользователя
     * GET /task-positions
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    getAllPositions(@CurrentUser() user: any) {
        return this.taskPositionsService.getAllPositions(user);
    }

    /**
     * Обновить позицию таски
     * PATCH /task-positions/:taskId
     */
    @Patch(':taskId')
    @HttpCode(HttpStatus.OK)
    updatePosition(
        @Param('taskId', ParseIntPipe) taskId: number,
        @Body() updateDto: UpdatePositionDto,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.updatePosition(taskId, updateDto, user);
    }

    /**
     * Создать новую группу тасок
     * POST /task-positions/group
     */
    @Post('group')
    @HttpCode(HttpStatus.CREATED)
    createGroup(@Body() createGroupDto: CreateGroupDto, @CurrentUser() user: any) {
        return this.taskPositionsService.createGroup(createGroupDto, user);
    }

    /**
     * Разгруппировать все таски в группе
     * DELETE /task-positions/group/:groupId
     */
    @Delete('group/:groupId')
    @HttpCode(HttpStatus.OK)
    ungroupTasks(
        @Param('groupId', ParseIntPipe) groupId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.ungroupTasks(groupId, user);
    }

    /**
     * Переместить всю группу
     * PATCH /task-positions/group/:groupId/move
     */
    @Patch('group/:groupId/move')
    @HttpCode(HttpStatus.OK)
    moveGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Body() updateDto: UpdatePositionDto,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.moveGroup(groupId, updateDto, user);
    }

    /**
     * Добавить таску в существующую группу
     * POST /task-positions/group/:groupId/task/:taskId
     */
    @Post('group/:groupId/task/:taskId')
    @HttpCode(HttpStatus.OK)
    addTaskToGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.addTaskToGroup(groupId, taskId, user);
    }

    /**
     * Удалить таску из группы
     * DELETE /task-positions/group/:groupId/task/:taskId
     */
    @Delete('group/:groupId/task/:taskId')
    @HttpCode(HttpStatus.OK)
    removeTaskFromGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @Query('x', ParseIntPipe) newX: number,
        @Query('y', ParseIntPipe) newY: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.removeTaskFromGroup(groupId, taskId, newX, newY, user);
    }

    /**
     * Получить информацию о группе
     * GET /task-positions/group/:groupId
     */
    @Get('group/:groupId')
    @HttpCode(HttpStatus.OK)
    getGroupInfo(
        @Param('groupId', ParseIntPipe) groupId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.getGroupInfo(groupId, user);
    }

    /**
     * Массовое обновление позиций
     * PATCH /task-positions/bulk
     */
    @Patch('bulk')
    @HttpCode(HttpStatus.OK)
    bulkUpdatePositions(
        @Body() body: { updates: Array<{ taskId: number; x: number; y: number }> },
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.bulkUpdatePositions(body.updates, user);
    }

    /**
     * Сбросить все позиции к дефолтному layout
     * POST /task-positions/reset
     */
    @Post('reset')
    @HttpCode(HttpStatus.OK)
    resetPositions(@CurrentUser() user: any) {
        return this.taskPositionsService.resetToDefaultLayout(user);
    }
}
