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
} from '@nestjs/common';
import { TaskPositionsService } from './task-positions.service';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('task-positions')
@UseGuards(SchoolAuthGuard)
export class TaskPositionsController {
    constructor(
        private readonly taskPositionsService: TaskPositionsService,
    ) { }

    /**
     * Получить все позиции тасок для пользователя
     * GET /task-positions
     */
    @Get()
    getAllPositions(@CurrentUser() user: any) {
        return this.taskPositionsService.getAllPositions(
            user.sessionId,
            user.schoolId,
        );
    }

    /**
     * Обновить позицию таски
     * PATCH /task-positions/:taskId
     */
    @Patch(':taskId')
    updatePosition(
        @Param('taskId', ParseIntPipe) taskId: number,
        @Body() updateDto: UpdatePositionDto,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.updatePosition(
            taskId,
            updateDto,
            user.sessionId,
        );
    }

    /**
     * Создать группу тасок
     * POST /task-positions/group
     */
    @Post('group')
    createGroup(@Body() createGroupDto: CreateGroupDto, @CurrentUser() user: any) {
        return this.taskPositionsService.createGroup(
            createGroupDto,
            user.sessionId,
            user.schoolId,
        );
    }

    /**
     * Разгруппировать таски
     * DELETE /task-positions/group/:groupId
     */
    @Delete('group/:groupId')
    ungroupTasks(
        @Param('groupId', ParseIntPipe) groupId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.ungroupTasks(groupId, user.sessionId);
    }

    /**
     * Переместить группу
     * PATCH /task-positions/group/:groupId/move
     */
    @Patch('group/:groupId/move')
    moveGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Body() updateDto: UpdatePositionDto,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.moveGroup(
            groupId,
            updateDto,
            user.sessionId,
        );
    }

    /**
     * Добавить таску в группу
     * POST /task-positions/group/:groupId/task/:taskId
     */
    @Post('group/:groupId/task/:taskId')
    addTaskToGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.addTaskToGroup(
            groupId,
            taskId,
            user.sessionId,
        );
    }

    /**
     * Удалить таску из группы
     * DELETE /task-positions/group/:groupId/task/:taskId
     */
    @Delete('group/:groupId/task/:taskId')
    removeTaskFromGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Param('taskId', ParseIntPipe) taskId: number,
        @Query('x', ParseIntPipe) newX: number,
        @Query('y', ParseIntPipe) newY: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.removeTaskFromGroup(
            groupId,
            taskId,
            newX,
            newY,
            user.sessionId,
        );
    }
}
