import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskView } from './entities/task-view.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto, TaskPriority } from './dto/task-filter.dto';

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private taskRepository: Repository<Task>,
        @InjectRepository(TaskAssignee)
        private assigneeRepository: Repository<TaskAssignee>,
        @InjectRepository(TaskView)
        private viewRepository: Repository<TaskView>,
    ) { }

    /**
     * Создать новую таску
     */
    async create(createTaskDto: CreateTaskDto, user: any) {
        // Создать таску
        const task = this.taskRepository.create({
            schoolId: user.schoolId,
            title: createTaskDto.title,
            description: createTaskDto.description,
            creatorName: user.fullName,
            deadline: new Date(createTaskDto.deadline),
        });

        const savedTask = await this.taskRepository.save(task);

        // Создать записи assignees
        const assignees = createTaskDto.assigneeCategories.map((category) => {
            return this.assigneeRepository.create({
                taskId: savedTask.id,
                assigneeCategory: category,
            });
        });

        await this.assigneeRepository.save(assignees);

        // Загрузить таску с assignees
        return this.findOne(savedTask.id, user);
    }

    /**
     * Получить все таски школы с фильтрацией
     */
    async findAll(user: any, filters?: TaskFilterDto) {
        const queryBuilder = this.taskRepository
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.assignees', 'assignees')
            .leftJoinAndSelect('task.views', 'views')
            .where('task.schoolId = :schoolId', { schoolId: user.schoolId })
            .orderBy('task.deadline', 'ASC');

        // Фильтр по категории
        if (filters?.category) {
            queryBuilder.andWhere('assignees.assigneeCategory = :category', {
                category: filters.category,
            });
        }

        // Фильтр по создателю
        if (filters?.creatorName) {
            queryBuilder.andWhere('task.creatorName = :creatorName', {
                creatorName: filters.creatorName,
            });
        }

        const tasks = await queryBuilder.getMany();

        // Фильтр по приоритету
        if (filters?.priority) {
            return tasks.filter(
                (task) => this.calculatePriority(task) === filters.priority,
            );
        }

        return tasks.map((task) => this.enrichTaskWithPriority(task, user));
    }

    /**
     * Получить одну таску по ID
     */
    async findOne(id: number, user: any) {
        const task = await this.taskRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'views'],
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        return this.enrichTaskWithPriority(task, user);
    }

    /**
     * Обновить таску
     */
    async update(id: number, updateTaskDto: UpdateTaskDto, user: any) {
        const task = await this.taskRepository.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees'],
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Проверить права: гость может редактировать только свои таски
        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Вы можете редактировать только свои задачи');
        }

        // Обновить поля
        if (updateTaskDto.title) task.title = updateTaskDto.title;
        if (updateTaskDto.description !== undefined)
            task.description = updateTaskDto.description;
        if (updateTaskDto.deadline)
            task.deadline = new Date(updateTaskDto.deadline);

        await this.taskRepository.save(task);

        // Обновить assignees если предоставлены
        if (updateTaskDto.assigneeCategories) {
            // Удалить старые
            await this.assigneeRepository.delete({ taskId: task.id });

            // Создать новые
            const newAssignees = updateTaskDto.assigneeCategories.map((category) => {
                return this.assigneeRepository.create({
                    taskId: task.id,
                    assigneeCategory: category,
                });
            });

            await this.assigneeRepository.save(newAssignees);
        }

        return this.findOne(id, user);
    }

    /**
     * Удалить таску
     */
    async remove(id: number, user: any) {
        const task = await this.taskRepository.findOne({
            where: { id, schoolId: user.schoolId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Проверить права: гость может удалять только свои таски
        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Вы можете удалять только свои задачи');
        }

        await this.taskRepository.remove(task);

        return { message: 'Задача успешно удалена', id };
    }

    /**
     * Удалить все просроченные таски (только для админов)
     */
    async removeOverdue(user: any) {
        if (!user.isAdmin) {
            throw new ForbiddenException('Доступно только администраторам');
        }

        const overdueTasks = await this.taskRepository.find({
            where: {
                schoolId: user.schoolId,
                isOverdue: true,
            },
        });

        await this.taskRepository.remove(overdueTasks);

        return {
            message: 'Просроченные задачи успешно удалены',
            count: overdueTasks.length,
        };
    }

    /**
     * Отметить просмотр таски
     */
    async markAsViewed(taskId: number, user: any) {
        const task = await this.taskRepository.findOne({
            where: { id: taskId, schoolId: user.schoolId },
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Проверить, не просмотрена ли уже
        const existingView = await this.viewRepository.findOne({
            where: {
                taskId,
                viewerName: user.fullName,
            },
        });

        if (existingView) {
            return { message: 'Задача уже отмечена как просмотренная' };
        }

        // Создать запись о просмотре
        const view = this.viewRepository.create({
            taskId,
            viewerName: user.fullName,
        });

        await this.viewRepository.save(view);

        return { message: 'Задача отмечена как просмотренная' };
    }

    /**
     * Получить список просмотревших таску
     */
    async getViews(taskId: number, user: any) {
        const task = await this.taskRepository.findOne({
            where: { id: taskId, schoolId: user.schoolId },
            relations: ['views'],
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // Гость может видеть просмотры только своих тасок
        // Админ может видеть просмотры всех тасок
        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException(
                'Вы можете просматривать информацию только по своим задачам',
            );
        }

        return {
            taskId,
            viewsCount: task.views.length,
            views: task.views.map((view) => ({
                viewerName: view.viewerName,
                viewedAt: view.viewedAt,
            })),
        };
    }

    /**
     * Автоматическая проверка просроченных тасок (каждый час)
     */
    @Cron(CronExpression.EVERY_HOUR)
    async checkOverdueTasks() {
        const now = new Date();

        const result = await this.taskRepository
            .createQueryBuilder()
            .update(Task)
            .set({ isOverdue: true })
            .where('deadline < :now', { now })
            .andWhere('isOverdue = :isOverdue', { isOverdue: false })
            .execute();

        if ((result.affected ?? 0) > 0) {
            console.log(
                `Проверка просроченных задач: ${result.affected} задач отмечено как просроченные`,
            );
        }
    }

    /**
     * Вычислить приоритет таски по дедлайну
     */
    private calculatePriority(task: Task): TaskPriority {
        const now = new Date();
        const hoursLeft =
            (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursLeft < 0 || task.isOverdue) return TaskPriority.OVERDUE;
        if (hoursLeft <= 24) return TaskPriority.URGENT;
        if (hoursLeft <= 72) return TaskPriority.MEDIUM;
        return TaskPriority.LOW;
    }

    /**
     * Обогатить таску информацией о приоритете
     */
    private enrichTaskWithPriority(task: Task, user: any) {
        const priority = this.calculatePriority(task);

        // Проверить, просмотрел ли пользователь эту таску
        const viewedByUser = task.views?.some(
            (view) => view.viewerName === user.fullName,
        );

        return {
            ...task,
            priority,
            viewedByUser,
            viewsCount: task.views?.length || 0,
        };
    }
}