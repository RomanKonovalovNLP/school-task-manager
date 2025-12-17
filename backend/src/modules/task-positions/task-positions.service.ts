import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskPosition } from './entities/task-position.entity';
import { TaskGroup } from './entities/task-group.entity';
import { Task } from '../tasks/entities/task.entity';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class TaskPositionsService {
    constructor(
        @InjectRepository(TaskPosition)
        private taskPositionsRepo: Repository<TaskPosition>,
        @InjectRepository(TaskGroup)
        private taskGroupsRepo: Repository<TaskGroup>,
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
    ) { }

    /**
     * Получить все позиции и группы для пользователя
     */
    async getAllPositions(userSessionId: number, schoolId: number) {
        // Получаем все таски школы
        const tasks = await this.tasksRepo.find({
            where: { schoolId },
            select: ['id'],
        });

        const taskIds = tasks.map((t) => t.id);

        // Получаем позиции тасок
        const positions = await this.taskPositionsRepo.find({
            where: { userSessionId },
        });

        // Создаем дефолтные позиции для тасок, у которых их нет
        const existingTaskIds = positions.map((p) => p.taskId);
        const missingTaskIds = taskIds.filter((id) => !existingTaskIds.includes(id));

        if (missingTaskIds.length > 0) {
            const newPositions = await this.createDefaultPositions(
                missingTaskIds,
                userSessionId,
                schoolId,
            );
            positions.push(...newPositions);
        }

        // Получаем группы
        const groups = await this.taskGroupsRepo.find({
            where: { userSessionId, schoolId },
        });

        return {
            positions,
            groups,
        };
    }

    /**
     * Создать дефолтные позиции для новых тасок (grid layout)
     */
    private async createDefaultPositions(
        taskIds: number[],
        userSessionId: number,
        schoolId: number,
    ): Promise<TaskPosition[]> {
        const COLUMNS = 4;
        const TASK_WIDTH = 280;
        const TASK_HEIGHT = 200;
        const PADDING = 20;

        const newPositions = taskIds.map((taskId, index) => {
            const row = Math.floor(index / COLUMNS);
            const col = index % COLUMNS;

            return this.taskPositionsRepo.create({
                taskId,
                userSessionId,
                positionX: PADDING + col * (TASK_WIDTH + PADDING),
                positionY: PADDING + row * (TASK_HEIGHT + PADDING),
                zIndex: 0,
                groupId: null,
            });
        });

        return this.taskPositionsRepo.save(newPositions);
    }

    /**
     * Обновить позицию таски
     */
    async updatePosition(
        taskId: number,
        updateDto: UpdatePositionDto,
        userSessionId: number,
    ) {
        const position = await this.taskPositionsRepo.findOne({
            where: { taskId, userSessionId },
        });

        if (!position) {
            // Создаем новую позицию, если её нет
            const newPosition = this.taskPositionsRepo.create({
                taskId,
                userSessionId,
                positionX: updateDto.x,
                positionY: updateDto.y,
                zIndex: 0,
            });
            return this.taskPositionsRepo.save(newPosition);
        }

        position.positionX = updateDto.x;
        position.positionY = updateDto.y;
        position.updatedAt = new Date();

        return this.taskPositionsRepo.save(position);
    }

    /**
     * Создать группу тасок
     */
    async createGroup(
        createGroupDto: CreateGroupDto,
        userSessionId: number,
        schoolId: number,
    ) {
        const { taskIds, x, y } = createGroupDto;

        if (taskIds.length < 2) {
            throw new BadRequestException('Группа должна содержать минимум 2 таски');
        }

        // Создаем группу
        const group = this.taskGroupsRepo.create({
            userSessionId,
            schoolId,
            positionX: x,
            positionY: y,
        });

        const savedGroup = await this.taskGroupsRepo.save(group);

        // Обновляем позиции тасок
        let zIndex = 0;
        for (const taskId of taskIds) {
            const position = await this.taskPositionsRepo.findOne({
                where: { taskId, userSessionId },
            });

            if (position) {
                position.groupId = savedGroup.id;
                position.positionX = x;
                position.positionY = y;
                position.zIndex = zIndex++;
                await this.taskPositionsRepo.save(position);
            }
        }

        return {
            groupId: savedGroup.id,
            taskIds,
            position: { x, y },
        };
    }

    /**
     * Добавить таску в существующую группу
     */
    async addTaskToGroup(groupId: number, taskId: number, userSessionId: number) {
        const group = await this.taskGroupsRepo.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Находим максимальный z-index в группе
        const tasksInGroup = await this.taskPositionsRepo.find({
            where: { groupId, userSessionId },
        });

        const maxZIndex = Math.max(...tasksInGroup.map((t) => t.zIndex || 0), -1);

        // Обновляем позицию таски
        const position = await this.taskPositionsRepo.findOne({
            where: { taskId, userSessionId },
        });

        if (!position) {
            throw new NotFoundException('Позиция таски не найдена');
        }

        position.groupId = groupId;
        position.positionX = group.positionX;
        position.positionY = group.positionY;
        position.zIndex = maxZIndex + 1;

        await this.taskPositionsRepo.save(position);

        return { success: true };
    }

    /**
     * Удалить таску из группы
     */
    async removeTaskFromGroup(
        groupId: number,
        taskId: number,
        newX: number,
        newY: number,
        userSessionId: number,
    ) {
        const position = await this.taskPositionsRepo.findOne({
            where: { taskId, userSessionId, groupId },
        });

        if (!position) {
            throw new NotFoundException('Таска не найдена в группе');
        }

        // Убираем из группы
        position.groupId = null;
        position.positionX = newX;
        position.positionY = newY;
        position.zIndex = 0;

        await this.taskPositionsRepo.save(position);

        // Проверяем, осталось ли в группе больше одной таски
        const remainingTasks = await this.taskPositionsRepo.count({
            where: { groupId, userSessionId },
        });

        if (remainingTasks <= 1) {
            // Удаляем группу и сбрасываем groupId последней таски
            await this.ungroupTasks(groupId, userSessionId);
        }

        return { success: true };
    }

    /**
     * Переместить всю группу
     */
    async moveGroup(groupId: number, updateDto: UpdatePositionDto, userSessionId: number) {
        const group = await this.taskGroupsRepo.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Обновляем позицию группы
        group.positionX = updateDto.x;
        group.positionY = updateDto.y;
        group.updatedAt = new Date();

        await this.taskGroupsRepo.save(group);

        // Обновляем позиции всех тасок в группе
        await this.taskPositionsRepo
            .createQueryBuilder()
            .update(TaskPosition)
            .set({
                positionX: updateDto.x,
                positionY: updateDto.y,
                updatedAt: new Date(),
            })
            .where('groupId = :groupId', { groupId })
            .andWhere('userSessionId = :userSessionId', { userSessionId })
            .execute();

        return { success: true };
    }

    /**
     * Разгруппировать все таски в группе
     */
    async ungroupTasks(groupId: number, userSessionId: number) {
        const group = await this.taskGroupsRepo.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Получаем все таски группы
        const groupTasks = await this.taskPositionsRepo.find({
            where: { groupId, userSessionId },
        });

        // Размещаем таски веером вокруг исходной позиции группы
        const OFFSET = 320; // отступ между тасками
        for (let i = 0; i < groupTasks.length; i++) {
            const task = groupTasks[i];
            task.groupId = null;
            task.positionX = group.positionX + i * OFFSET;
            task.positionY = group.positionY;
            task.zIndex = 0;
        }

        await this.taskPositionsRepo.save(groupTasks);

        // Удаляем группу
        await this.taskGroupsRepo.delete({ id: groupId });

        return { success: true };
    }

    /**
     * Получить информацию о группе
     */
    async getGroupInfo(groupId: number, userSessionId: number) {
        const group = await this.taskGroupsRepo.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        const tasks = await this.taskPositionsRepo.find({
            where: { groupId, userSessionId },
        });

        return {
            id: group.id,
            position: { x: group.positionX, y: group.positionY },
            taskIds: tasks.map((t) => t.taskId),
            taskCount: tasks.length,
        };
    }

    /**
     * Массовое обновление позиций
     */
    async bulkUpdatePositions(
        updates: Array<{ taskId: number; x: number; y: number }>,
        userSessionId: number,
    ) {
        const promises = updates.map(async (update) => {
            const position = await this.taskPositionsRepo.findOne({
                where: { taskId: update.taskId, userSessionId },
            });

            if (position) {
                position.positionX = update.x;
                position.positionY = update.y;
                position.updatedAt = new Date();
                return this.taskPositionsRepo.save(position);
            }
        });

        await Promise.all(promises);

        return { success: true, updated: updates.length };
    }

    /**
     * Сбросить все позиции к дефолтному grid layout
     */
    async resetToDefaultLayout(userSessionId: number, schoolId: number) {
        // Удаляем все существующие позиции
        await this.taskPositionsRepo.delete({ userSessionId });

        // Удаляем все группы
        await this.taskGroupsRepo.delete({ userSessionId, schoolId });

        // Получаем все таски и создаем дефолтные позиции
        const tasks = await this.tasksRepo.find({
            where: { schoolId },
            select: ['id'],
        });

        const taskIds = tasks.map((t) => t.id);
        await this.createDefaultPositions(taskIds, userSessionId, schoolId);

        return { success: true, message: 'Позиции сброшены к дефолтным' };
    }
}