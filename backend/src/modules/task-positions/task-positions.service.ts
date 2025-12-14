import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TaskPosition } from './entities/task-position.entity';
import { TaskGroup } from './entities/task-group.entity';
import { Task } from '../tasks/entities/task.entity';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class TaskPositionsService {
    constructor(
        @InjectRepository(TaskPosition)
        private positionRepository: Repository<TaskPosition>,
        @InjectRepository(TaskGroup)
        private groupRepository: Repository<TaskGroup>,
        @InjectRepository(Task)
        private taskRepository: Repository<Task>,
    ) { }

    /**
     * Получить все позиции тасок для пользователя
     */
    async getAllPositions(userSessionId: number, schoolId: number) {
        const positions = await this.positionRepository.find({
            where: { userSessionId },
            relations: ['task'],
        });

        const groups = await this.groupRepository.find({
            where: { userSessionId, schoolId },
        });

        // Получить все таски школы
        const allTasks = await this.taskRepository.find({
            where: { schoolId },
            relations: ['assignees', 'views'],
        });

        // Создать дефолтные позиции для тасок, у которых их нет
        const tasksWithoutPositions = allTasks.filter(
            (task) => !positions.find((p) => p.taskId === task.id),
        );

        const defaultPositions = this.generateDefaultPositions(
            tasksWithoutPositions,
            userSessionId,
        );

        return {
            positions: [...positions, ...defaultPositions],
            groups,
        };
    }

    /**
     * Обновить позицию таски
     */
    async updatePosition(
        taskId: number,
        updateDto: UpdatePositionDto,
        userSessionId: number,
    ) {
        let position = await this.positionRepository.findOne({
            where: { taskId, userSessionId },
        });

        if (!position) {
            // Создать новую позицию
            position = this.positionRepository.create({
                taskId,
                userSessionId,
                positionX: updateDto.x,
                positionY: updateDto.y,
                zIndex: 0,
                groupId: null,
            });
        } else {
            position.positionX = updateDto.x;
            position.positionY = updateDto.y;
        }

        return this.positionRepository.save(position);
    }

    /**
     * Создать группу тасок
     */
    async createGroup(
        createGroupDto: CreateGroupDto,
        userSessionId: number,
        schoolId: number,
    ) {
        // Проверить что все таски существуют
        const tasks = await this.taskRepository.find({
            where: { id: In(createGroupDto.taskIds), schoolId },
        });

        if (tasks.length !== createGroupDto.taskIds.length) {
            throw new NotFoundException('Некоторые задачи не найдены');
        }

        // Создать группу
        const group = this.groupRepository.create({
            schoolId,
            userSessionId,
            positionX: createGroupDto.x,
            positionY: createGroupDto.y,
        });

        const savedGroup = await this.groupRepository.save(group);

        // Обновить позиции тасок - присвоить groupId
        for (let i = 0; i < createGroupDto.taskIds.length; i++) {
            const taskId = createGroupDto.taskIds[i];
            let position = await this.positionRepository.findOne({
                where: { taskId, userSessionId },
            });

            if (!position) {
                position = this.positionRepository.create({
                    taskId,
                    userSessionId,
                    positionX: createGroupDto.x,
                    positionY: createGroupDto.y,
                    zIndex: i,
                    groupId: savedGroup.id,
                });
            } else {
                position.positionX = createGroupDto.x;
                position.positionY = createGroupDto.y;
                position.zIndex = i;
                position.groupId = savedGroup.id;
            }

            await this.positionRepository.save(position);
        }

        return savedGroup;
    }

    /**
     * Разгруппировать таски
     */
    async ungroupTasks(groupId: number, userSessionId: number) {
        // Найти все позиции с этим groupId
        const positions = await this.positionRepository.find({
            where: { groupId, userSessionId },
        });

        // Убрать groupId у всех позиций
        for (const position of positions) {
            position.groupId = null;
            await this.positionRepository.save(position);
        }

        // Удалить группу
        await this.groupRepository.delete({ id: groupId, userSessionId });

        return { message: 'Группа расформирована', affectedTasks: positions.length };
    }

    /**
     * Переместить группу
     */
    async moveGroup(
        groupId: number,
        updateDto: UpdatePositionDto,
        userSessionId: number,
    ) {
        const group = await this.groupRepository.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        const deltaX = updateDto.x - group.positionX;
        const deltaY = updateDto.y - group.positionY;

        // Обновить позицию группы
        group.positionX = updateDto.x;
        group.positionY = updateDto.y;
        await this.groupRepository.save(group);

        // Переместить все таски в группе
        const positions = await this.positionRepository.find({
            where: { groupId, userSessionId },
        });

        for (const position of positions) {
            position.positionX += deltaX;
            position.positionY += deltaY;
            await this.positionRepository.save(position);
        }

        return group;
    }

    /**
     * Добавить таску в группу
     */
    async addTaskToGroup(
        groupId: number,
        taskId: number,
        userSessionId: number,
    ) {
        const group = await this.groupRepository.findOne({
            where: { id: groupId, userSessionId },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Найти максимальный zIndex в группе
        const positions = await this.positionRepository.find({
            where: { groupId, userSessionId },
            order: { zIndex: 'DESC' },
        });

        const maxZIndex = positions.length > 0 ? positions[0].zIndex : 0;

        // Обновить или создать позицию
        let position = await this.positionRepository.findOne({
            where: { taskId, userSessionId },
        });

        if (!position) {
            position = this.positionRepository.create({
                taskId,
                userSessionId,
                positionX: group.positionX,
                positionY: group.positionY,
                zIndex: maxZIndex + 1,
                groupId: group.id,
            });
        } else {
            position.positionX = group.positionX;
            position.positionY = group.positionY;
            position.zIndex = maxZIndex + 1;
            position.groupId = group.id;
        }

        return this.positionRepository.save(position);
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
        const position = await this.positionRepository.findOne({
            where: { taskId, userSessionId, groupId },
        });

        if (!position) {
            throw new NotFoundException('Задача не найдена в группе');
        }

        position.groupId = null;
        position.positionX = newX;
        position.positionY = newY;
        await this.positionRepository.save(position);

        // Проверить, осталась ли в группе хотя бы 1 таска
        const remainingPositions = await this.positionRepository.find({
            where: { groupId, userSessionId },
        });

        // Если осталась только 1 таска или 0 - удалить группу
        if (remainingPositions.length <= 1) {
            await this.groupRepository.delete({ id: groupId, userSessionId });

            // Убрать groupId у оставшейся таски
            if (remainingPositions.length === 1) {
                remainingPositions[0].groupId = null;
                await this.positionRepository.save(remainingPositions[0]);
            }
        }

        return position;
    }

    /**
     * Генерация дефолтных позиций для новых тасок (grid layout)
     */
    private generateDefaultPositions(
        tasks: Task[],
        userSessionId: number,
    ): Partial<TaskPosition>[] {
        const TASK_WIDTH = 280;
        const TASK_HEIGHT = 200;
        const PADDING = 20;
        const COLUMNS = 4;

        return tasks.map((task, index) => {
            const column = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            return {
                taskId: task.id,
                userSessionId,
                positionX: PADDING + column * (TASK_WIDTH + PADDING),
                positionY: PADDING + row * (TASK_HEIGHT + PADDING),
                zIndex: 0,
                groupId: null,
            };
        });
    }
}