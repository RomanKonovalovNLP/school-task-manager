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
    constructor(private readonly taskPositionsService: TaskPositionsService) { }

    /**
     * Получить все позиции тасок и группы для текущего пользователя
     * GET /task-positions
     * 
     * @returns {
     *   positions: TaskPosition[],
     *   groups: TaskGroup[]
     * }
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    getAllPositions(@CurrentUser() user: any) {
        return this.taskPositionsService.getAllPositions(user.sessionId, user.schoolId);
    }

    /**
     * Обновить позицию таски
     * PATCH /task-positions/:taskId
     * 
     * Body: { x: number, y: number }
     */
    @Patch(':taskId')
    @HttpCode(HttpStatus.OK)
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
     * Создать новую группу тасок
     * POST /task-positions/group
     * 
     * Body: { taskIds: number[], x: number, y: number }
     */
    @Post('group')
    @HttpCode(HttpStatus.CREATED)
    createGroup(@Body() createGroupDto: CreateGroupDto, @CurrentUser() user: any) {
        return this.taskPositionsService.createGroup(
            createGroupDto,
            user.sessionId,
            user.schoolId,
        );
    }

    /**
     * Разгруппировать все таски в группе
     * DELETE /task-positions/group/:groupId
     * 
     * Автоматически удаляет группу и сбрасывает groupId всех тасок
     */
    @Delete('group/:groupId')
    @HttpCode(HttpStatus.OK)
    ungroupTasks(
        @Param('groupId', ParseIntPipe) groupId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.ungroupTasks(groupId, user.sessionId);
    }

    /**
     * Переместить всю группу (все таски внутри нее)
     * PATCH /task-positions/group/:groupId/move
     * 
     * Body: { x: number, y: number }
     */
    @Patch('group/:groupId/move')
    @HttpCode(HttpStatus.OK)
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
     * Добавить таску в существующую группу
     * POST /task-positions/group/:groupId/task/:taskId
     * 
     * Таска автоматически перемещается к позиции группы
     */
    @Post('group/:groupId/task/:taskId')
    @HttpCode(HttpStatus.OK)
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
     * DELETE /task-positions/group/:groupId/task/:taskId?x=300&y=400
     * 
     * Query params:
     * - x: новая X координата таски
     * - y: новая Y координата таски
     * 
     * Если в группе останется ≤1 таска, группа автоматически удаляется
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
        return this.taskPositionsService.removeTaskFromGroup(
            groupId,
            taskId,
            newX,
            newY,
            user.sessionId,
        );
    }

    /**
     * Получить информацию о конкретной группе
     * GET /task-positions/group/:groupId
     * 
     * @returns {
     *   id: number,
     *   position: { x: number, y: number },
     *   taskIds: number[],
     *   taskCount: number
     * }
     */
    @Get('group/:groupId')
    @HttpCode(HttpStatus.OK)
    getGroupInfo(
        @Param('groupId', ParseIntPipe) groupId: number,
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.getGroupInfo(groupId, user.sessionId);
    }

    /**
     * Массовое обновление позиций (полезно для синхронизации)
     * PATCH /task-positions/bulk
     * 
     * Body: {
     *   updates: Array<{ taskId: number, x: number, y: number }>
     * }
     */
    @Patch('bulk')
    @HttpCode(HttpStatus.OK)
    bulkUpdatePositions(
        @Body() body: { updates: Array<{ taskId: number; x: number; y: number }> },
        @CurrentUser() user: any,
    ) {
        return this.taskPositionsService.bulkUpdatePositions(
            body.updates,
            user.sessionId,
        );
    }

    /**
     * Сбросить все позиции к дефолтному grid layout
     * POST /task-positions/reset
     * 
     * Полезно для новых пользователей или для сброса раскладки
     */
    @Post('reset')
    @HttpCode(HttpStatus.OK)
    resetPositions(@CurrentUser() user: any) {
        return this.taskPositionsService.resetToDefaultLayout(
            user.sessionId,
            user.schoolId,
        );
    }
}