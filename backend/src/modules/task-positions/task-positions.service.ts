import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TaskPosition } from './entities/task-position.entity';
import { TaskGroup } from './entities/task-group.entity';
import { Task } from '../tasks/entities/task.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UpdatePositionDto } from './dto/update-position.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class TaskPositionsService {
    constructor(
        @InjectRepository(TaskPosition)
        private positionsRepo: Repository<TaskPosition>,
        @InjectRepository(TaskGroup)
        private groupsRepo: Repository<TaskGroup>,
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
    ) {}

    /**
     * Получить или создать профиль пользователя
     */
    private async getOrCreateProfile(user: any): Promise<UserProfile> {
        let profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        if (!profile) {
            profile = this.userProfileRepo.create({
                schoolId: user.schoolId,
                fullName: user.fullName,
            });
            profile = await this.userProfileRepo.save(profile);
        }

        return profile;
    }

    /**
     * Получить все позиции и группы для пользователя
     */
    async getAllPositions(user: any) {
        const profile = await this.getOrCreateProfile(user);

        // Получаем все задачи школы
        const tasks = await this.tasksRepo.find({
            where: { schoolId: user.schoolId },
            select: ['id'],
        });

        const taskIds = tasks.map((t) => t.id);

        // Получаем существующие позиции
        const existingPositions = await this.positionsRepo.find({
            where: { userProfileId: profile.id },
        });

        const existingTaskIds = existingPositions.map((p) => p.taskId);
        const missingTaskIds = taskIds.filter((id) => !existingTaskIds.includes(id));

        // Создаём позиции для новых задач (grid layout)
        if (missingTaskIds.length > 0) {
            const TASK_WIDTH = 300;
            const TASK_HEIGHT = 220;
            const PADDING = 20;
            const COLUMNS = 5;

            const newPositions = missingTaskIds.map((taskId, index) => {
                const totalIndex = existingPositions.length + index;
                const col = totalIndex % COLUMNS;
                const row = Math.floor(totalIndex / COLUMNS);

                return this.positionsRepo.create({
                    taskId,
                    userProfileId: profile.id,
                    positionX: col * (TASK_WIDTH + PADDING) + PADDING,
                    positionY: row * (TASK_HEIGHT + PADDING) + PADDING,
                    zIndex: 0,
                    groupId: null,
                });
            });

            await this.positionsRepo.save(newPositions);
        }

        // Получаем все позиции заново
        const positions = await this.positionsRepo.find({
            where: { userProfileId: profile.id },
        });

        // Фильтруем позиции только для существующих задач
        const validPositions = positions.filter((p) => taskIds.includes(p.taskId));

        // Получаем группы
        const groups = await this.groupsRepo.find({
            where: { userProfileId: profile.id, schoolId: user.schoolId },
        });

        return {
            positions: validPositions.map((p) => ({
                id: p.id,
                taskId: p.taskId,
                userSessionId: profile.id, // для совместимости с фронтендом
                positionX: p.positionX,
                positionY: p.positionY,
                zIndex: p.zIndex,
                groupId: p.groupId,
                createdAt: p.updatedAt?.toISOString(),
                updatedAt: p.updatedAt?.toISOString(),
            })),
            groups: groups.map((g) => ({
                id: g.id,
                userSessionId: profile.id,
                schoolId: g.schoolId,
                positionX: g.positionX,
                positionY: g.positionY,
                createdAt: g.createdAt?.toISOString(),
                updatedAt: g.updatedAt?.toISOString(),
            })),
        };
    }

    /**
     * Обновить позицию задачи
     */
    async updatePosition(taskId: number, dto: UpdatePositionDto, user: any) {
        const profile = await this.getOrCreateProfile(user);

        // Проверяем что задача существует и принадлежит школе
        const task = await this.tasksRepo.findOne({
            where: { id: taskId, schoolId: user.schoolId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Находим или создаём позицию
        let position = await this.positionsRepo.findOne({
            where: { taskId, userProfileId: profile.id },
        });

        if (!position) {
            position = this.positionsRepo.create({
                taskId,
                userProfileId: profile.id,
                positionX: dto.x,
                positionY: dto.y,
                zIndex: 0,
                groupId: null,
            });
        } else {
            position.positionX = dto.x;
            position.positionY = dto.y;
            // Если задача была в группе, удаляем из группы
            if (position.groupId !== null) {
                position.groupId = null;
            }
        }

        const saved = await this.positionsRepo.save(position);

        return {
            id: saved.id,
            taskId: saved.taskId,
            userSessionId: profile.id,
            positionX: saved.positionX,
            positionY: saved.positionY,
            zIndex: saved.zIndex,
            groupId: saved.groupId,
            updatedAt: saved.updatedAt?.toISOString(),
        };
    }

    /**
     * Создать группу задач
     */
    async createGroup(dto: CreateGroupDto, user: any) {
        const profile = await this.getOrCreateProfile(user);

        // Проверяем что все задачи существуют
        const tasks = await this.tasksRepo.find({
            where: { id: In(dto.taskIds), schoolId: user.schoolId },
        });

        if (tasks.length !== dto.taskIds.length) {
            throw new NotFoundException('Некоторые задачи не найдены');
        }

        // Создаём группу
        const group = this.groupsRepo.create({
            userProfileId: profile.id,
            schoolId: user.schoolId,
            positionX: dto.x,
            positionY: dto.y,
        });

        const savedGroup = await this.groupsRepo.save(group);

        // Обновляем позиции задач
        for (let i = 0; i < dto.taskIds.length; i++) {
            const taskId = dto.taskIds[i];

            let position = await this.positionsRepo.findOne({
                where: { taskId, userProfileId: profile.id },
            });

            if (!position) {
                position = this.positionsRepo.create({
                    taskId,
                    userProfileId: profile.id,
                    positionX: dto.x,
                    positionY: dto.y,
                    zIndex: i,
                    groupId: savedGroup.id,
                });
            } else {
                position.positionX = dto.x;
                position.positionY = dto.y;
                position.zIndex = i;
                position.groupId = savedGroup.id;
            }

            await this.positionsRepo.save(position);
        }

        return {
            id: savedGroup.id,
            userSessionId: profile.id,
            schoolId: savedGroup.schoolId,
            positionX: savedGroup.positionX,
            positionY: savedGroup.positionY,
            taskIds: dto.taskIds,
        };
    }

    /**
     * Разгруппировать все задачи в группе
     */
    async ungroupTasks(groupId: number, user: any) {
        const profile = await this.getOrCreateProfile(user);

        const group = await this.groupsRepo.findOne({
            where: { id: groupId, userProfileId: profile.id },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Получаем все позиции в группе
        const positions = await this.positionsRepo.find({
            where: { groupId, userProfileId: profile.id },
        });

        // Раскидываем задачи в grid от позиции группы
        const TASK_WIDTH = 300;
        const TASK_HEIGHT = 220;
        const PADDING = 20;

        for (let i = 0; i < positions.length; i++) {
            const col = i % 3;
            const row = Math.floor(i / 3);

            positions[i].positionX = group.positionX + col * (TASK_WIDTH + PADDING);
            positions[i].positionY = group.positionY + row * (TASK_HEIGHT + PADDING);
            positions[i].groupId = null;
            positions[i].zIndex = 0;
        }

        await this.positionsRepo.save(positions);

        // Удаляем группу
        await this.groupsRepo.remove(group);

        return { success: true };
    }

    /**
     * Переместить группу
     */
    async moveGroup(groupId: number, dto: UpdatePositionDto, user: any) {
        const profile = await this.getOrCreateProfile(user);

        const group = await this.groupsRepo.findOne({
            where: { id: groupId, userProfileId: profile.id },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        // Вычисляем смещение
        const deltaX = dto.x - group.positionX;
        const deltaY = dto.y - group.positionY;

        // Обновляем позицию группы
        group.positionX = dto.x;
        group.positionY = dto.y;
        await this.groupsRepo.save(group);

        // Обновляем позиции всех задач в группе
        const positions = await this.positionsRepo.find({
            where: { groupId, userProfileId: profile.id },
        });

        for (const position of positions) {
            position.positionX += deltaX;
            position.positionY += deltaY;
        }

        await this.positionsRepo.save(positions);

        return { success: true };
    }

    /**
     * Добавить задачу в группу
     */
    async addTaskToGroup(groupId: number, taskId: number, user: any) {
        const profile = await this.getOrCreateProfile(user);

        const group = await this.groupsRepo.findOne({
            where: { id: groupId, userProfileId: profile.id },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        const task = await this.tasksRepo.findOne({
            where: { id: taskId, schoolId: user.schoolId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Получаем максимальный zIndex в группе
        const maxZIndex = await this.positionsRepo
            .createQueryBuilder('pos')
            .where('pos.groupId = :groupId', { groupId })
            .andWhere('pos.userProfileId = :profileId', { profileId: profile.id })
            .select('MAX(pos.zIndex)', 'maxZ')
            .getRawOne();

        const newZIndex = (maxZIndex?.maxZ || 0) + 1;

        // Обновляем позицию задачи
        let position = await this.positionsRepo.findOne({
            where: { taskId, userProfileId: profile.id },
        });

        if (!position) {
            position = this.positionsRepo.create({
                taskId,
                userProfileId: profile.id,
                positionX: group.positionX,
                positionY: group.positionY,
                zIndex: newZIndex,
                groupId,
            });
        } else {
            position.positionX = group.positionX;
            position.positionY = group.positionY;
            position.zIndex = newZIndex;
            position.groupId = groupId;
        }

        await this.positionsRepo.save(position);

        return { success: true };
    }

    /**
     * Удалить задачу из группы
     */
    async removeTaskFromGroup(
        groupId: number,
        taskId: number,
        newX: number,
        newY: number,
        user: any,
    ) {
        const profile = await this.getOrCreateProfile(user);

        const position = await this.positionsRepo.findOne({
            where: { taskId, groupId, userProfileId: profile.id },
        });

        if (!position) {
            throw new NotFoundException('Позиция задачи не найдена в группе');
        }

        position.positionX = newX;
        position.positionY = newY;
        position.groupId = null;
        position.zIndex = 0;

        await this.positionsRepo.save(position);

        // Проверяем, остались ли задачи в группе
        const remaining = await this.positionsRepo.count({
            where: { groupId, userProfileId: profile.id },
        });

        // Если осталась только одна задача, разгруппируем
        if (remaining <= 1) {
            await this.ungroupTasks(groupId, user);
        }

        return { success: true };
    }

    /**
     * Получить информацию о группе
     */
    async getGroupInfo(groupId: number, user: any) {
        const profile = await this.getOrCreateProfile(user);

        const group = await this.groupsRepo.findOne({
            where: { id: groupId, userProfileId: profile.id },
        });

        if (!group) {
            throw new NotFoundException('Группа не найдена');
        }

        const positions = await this.positionsRepo.find({
            where: { groupId, userProfileId: profile.id },
            order: { zIndex: 'DESC' },
        });

        return {
            id: group.id,
            position: { x: group.positionX, y: group.positionY },
            taskIds: positions.map((p) => p.taskId),
            taskCount: positions.length,
        };
    }

    /**
     * Массовое обновление позиций
     */
    async bulkUpdatePositions(
        updates: Array<{ taskId: number; x: number; y: number }>,
        user: any,
    ) {
        const profile = await this.getOrCreateProfile(user);

        let updated = 0;

        for (const update of updates) {
            const task = await this.tasksRepo.findOne({
                where: { id: update.taskId, schoolId: user.schoolId },
            });

            if (!task) continue;

            let position = await this.positionsRepo.findOne({
                where: { taskId: update.taskId, userProfileId: profile.id },
            });

            if (!position) {
                position = this.positionsRepo.create({
                    taskId: update.taskId,
                    userProfileId: profile.id,
                    positionX: update.x,
                    positionY: update.y,
                    zIndex: 0,
                    groupId: null,
                });
            } else {
                position.positionX = update.x;
                position.positionY = update.y;
            }

            await this.positionsRepo.save(position);
            updated++;
        }

        return { success: true, updated };
    }

    /**
     * Сбросить позиции к дефолтному layout
     */
    async resetToDefaultLayout(user: any) {
        const profile = await this.getOrCreateProfile(user);

        // Удаляем все группы
        await this.groupsRepo.delete({
            userProfileId: profile.id,
            schoolId: user.schoolId,
        });

        // Удаляем все позиции
        await this.positionsRepo.delete({
            userProfileId: profile.id,
        });

        // Вызываем getAllPositions чтобы создать новые позиции
        await this.getAllPositions(user);

        return { success: true, message: 'Позиции сброшены' };
    }
}
