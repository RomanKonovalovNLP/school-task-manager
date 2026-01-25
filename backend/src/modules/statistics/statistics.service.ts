import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../tasks/entities/task-assignee.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { TaskStatistic } from './entities/task-statistic.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class StatisticsService {
    constructor(
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
        @InjectRepository(TaskAssignee)
        private assigneesRepo: Repository<TaskAssignee>,
        @InjectRepository(TaskCompletion)
        private completionsRepo: Repository<TaskCompletion>,
        @InjectRepository(TaskStatistic)
        private statisticsRepo: Repository<TaskStatistic>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
    ) {}

    /**
     * Получить общую статистику
     */
    async getStatistics(schoolId: number, startDate?: string, endDate?: string) {
        const qb = this.tasksRepo
            .createQueryBuilder('task')
            .where('task.schoolId = :schoolId', { schoolId });

        if (startDate) {
            qb.andWhere('task.createdAt >= :startDate', { startDate: new Date(startDate) });
        }
        if (endDate) {
            qb.andWhere('task.createdAt <= :endDate', { endDate: new Date(endDate) });
        }

        const tasks = await qb.getMany();
        const now = new Date();

        // Подсчёт статистики
        let totalTasks = tasks.length;
        let overdueTasks = 0;
        let urgentTasks = 0;
        let mediumPriorityTasks = 0;
        let lowPriorityTasks = 0;

        for (const task of tasks) {
            const deadline = new Date(task.deadline);
            const diff = deadline.getTime() - now.getTime();
            const hours = diff / (1000 * 60 * 60);

            if (hours < 0) {
                overdueTasks++;
            } else if (hours <= 24) {
                urgentTasks++;
            } else if (hours <= 72) {
                mediumPriorityTasks++;
            } else {
                lowPriorityTasks++;
            }
        }

        // Подсчёт выполненных задач
        const completedTaskIds = await this.completionsRepo
            .createQueryBuilder('completion')
            .select('DISTINCT completion.taskId', 'taskId')
            .innerJoin('tasks', 'task', 'task.id = completion.taskId')
            .where('task.schoolId = :schoolId', { schoolId })
            .getRawMany();

        const completedTasks = completedTaskIds.length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Статистика по категориям
        const categoryStats = await this.assigneesRepo
            .createQueryBuilder('assignee')
            .select('assignee.assigneeCategory', 'category')
            .addSelect('COUNT(DISTINCT assignee.taskId)', 'count')
            .innerJoin('tasks', 'task', 'task.id = assignee.taskId')
            .where('task.schoolId = :schoolId', { schoolId })
            .groupBy('assignee.assigneeCategory')
            .getRawMany();

        const tasksByCategory: Record<string, number> = {};
        for (const stat of categoryStats) {
            tasksByCategory[stat.category] = parseInt(stat.count);
        }

        return {
            totalTasks,
            completedTasks,
            overdueTasks,
            urgentTasks,
            mediumPriorityTasks,
            lowPriorityTasks,
            tasksByCategory,
            tasksByPriority: {
                urgent: urgentTasks,
                medium: mediumPriorityTasks,
                low: lowPriorityTasks,
                overdue: overdueTasks,
            },
            completionRate,
            avgCompletionTime: null, // TODO: Реализовать если нужно
        };
    }

    /**
     * Получить тренды за N дней
     */
    async getTrends(schoolId: number, days: number = 30) {
        const trends = await this.statisticsRepo.find({
            where: { schoolId },
            order: { date: 'DESC' },
            take: days,
        });

        return trends.reverse().map((t) => {
            // date может приходить как строка или Date в зависимости от драйвера БД
            const dateValue = t.date as unknown;
            const dateStr = dateValue instanceof Date 
                ? dateValue.toISOString().split('T')[0] 
                : String(dateValue).split('T')[0];
            
            return {
                date: dateStr,
                totalTasks: t.totalTasks,
                completedTasks: t.completedTasks,
                overdueTasks: t.overdueTasks,
            };
        });
    }

    /**
     * Получить статистику по категориям
     */
    async getCategoryStatistics(schoolId: number) {
        const stats = await this.assigneesRepo
            .createQueryBuilder('assignee')
            .select('assignee.assigneeCategory', 'name')
            .addSelect('COUNT(DISTINCT assignee.taskId)', 'count')
            .innerJoin('tasks', 'task', 'task.id = assignee.taskId')
            .where('task.schoolId = :schoolId', { schoolId })
            .groupBy('assignee.assigneeCategory')
            .orderBy('count', 'DESC')
            .getRawMany();

        const total = stats.reduce((sum, s) => sum + parseInt(s.count), 0);

        return {
            categories: stats.map((s) => ({
                name: s.name,
                count: parseInt(s.count),
                percentage: total > 0 ? (parseInt(s.count) / total) * 100 : 0,
            })),
        };
    }

    /**
     * Получить статистику по создателям
     */
    async getCreatorStatistics(schoolId: number) {
        const stats = await this.tasksRepo
            .createQueryBuilder('task')
            .select('task.creatorName', 'name')
            .addSelect('COUNT(*)', 'count')
            .where('task.schoolId = :schoolId', { schoolId })
            .groupBy('task.creatorName')
            .orderBy('count', 'DESC')
            .getRawMany();

        const total = stats.reduce((sum, s) => sum + parseInt(s.count), 0);

        return {
            creators: stats.map((s) => ({
                name: s.name,
                count: parseInt(s.count),
                percentage: total > 0 ? (parseInt(s.count) / total) * 100 : 0,
            })),
        };
    }

    // ==================== НОВОЕ: Расширенная статистика для админов ====================

    /**
     * Получить статистику выполнения по пользователям
     */
    async getUserCompletionStatistics(schoolId: number) {
        // Получаем всех пользователей с профилями
        const profiles = await this.userProfileRepo.find({
            where: { schoolId },
        });

        // Получаем статистику выполнения для каждого пользователя
        const userStats = await Promise.all(
            profiles.map(async (profile) => {
                // Количество выполненных задач
                const completedCount = await this.completionsRepo.count({
                    where: { userProfileId: profile.id },
                });

                // Получаем последние выполненные задачи
                const recentCompletions = await this.completionsRepo.find({
                    where: { userProfileId: profile.id },
                    relations: ['task'],
                    order: { completedAt: 'DESC' },
                    take: 5,
                });

                return {
                    userId: profile.id,
                    fullName: profile.fullName,
                    completedTasksCount: completedCount,
                    recentCompletions: recentCompletions.map((c) => ({
                        taskId: c.taskId,
                        taskTitle: c.task?.title || 'Удалённая задача',
                        completedAt: c.completedAt.toISOString(),
                    })),
                };
            }),
        );

        // Сортируем по количеству выполненных задач
        userStats.sort((a, b) => b.completedTasksCount - a.completedTasksCount);

        // Общая статистика
        const totalCompletions = userStats.reduce((sum, u) => sum + u.completedTasksCount, 0);
        const avgCompletionsPerUser = userStats.length > 0 ? totalCompletions / userStats.length : 0;

        return {
            users: userStats,
            summary: {
                totalUsers: userStats.length,
                totalCompletions,
                avgCompletionsPerUser: Math.round(avgCompletionsPerUser * 100) / 100,
            },
        };
    }

    /**
     * Получить детальную статистику по каждой задаче с процентом выполнения
     */
    async getTasksCompletionStatistics(schoolId: number) {
        // Получаем все задачи с assignees
        const tasks = await this.tasksRepo.find({
            where: { schoolId },
            relations: ['assignees'],
            order: { createdAt: 'DESC' },
        });

        // Для каждой задачи получаем статистику выполнения
        const taskStats = await Promise.all(
            tasks.map(async (task) => {
                // Получаем количество выполнивших
                const completions = await this.completionsRepo.find({
                    where: { taskId: task.id },
                    relations: ['userProfile'],
                });

                // Категории задачи
                const categories = task.assignees?.map((a) => a.assigneeCategory) || [];

                // Подсчёт потенциальных исполнителей (пользователей в этих категориях)
                // Это сложный запрос, упрощаем - просто показываем количество выполнивших
                const completedBy = completions.map((c) => ({
                    fullName: c.userProfile.fullName,
                    completedAt: c.completedAt.toISOString(),
                }));

                // Определяем приоритет
                const now = new Date();
                const deadline = new Date(task.deadline);
                const diff = deadline.getTime() - now.getTime();
                const hours = diff / (1000 * 60 * 60);

                let priority: string;
                if (hours < 0) {
                    priority = 'overdue';
                } else if (hours <= 24) {
                    priority = 'urgent';
                } else if (hours <= 72) {
                    priority = 'medium';
                } else {
                    priority = 'low';
                }

                return {
                    taskId: task.id,
                    title: task.title,
                    creatorName: task.creatorName,
                    deadline: task.deadline,
                    priority,
                    categories,
                    completionCount: completions.length,
                    completedBy,
                    createdAt: task.createdAt,
                };
            }),
        );

        // Группируем по приоритету
        const byPriority = {
            overdue: taskStats.filter((t) => t.priority === 'overdue'),
            urgent: taskStats.filter((t) => t.priority === 'urgent'),
            medium: taskStats.filter((t) => t.priority === 'medium'),
            low: taskStats.filter((t) => t.priority === 'low'),
        };

        // Общая статистика
        const totalTasks = taskStats.length;
        const tasksWithCompletions = taskStats.filter((t) => t.completionCount > 0).length;
        const avgCompletionsPerTask = totalTasks > 0
            ? taskStats.reduce((sum, t) => sum + t.completionCount, 0) / totalTasks
            : 0;

        return {
            tasks: taskStats,
            byPriority,
            summary: {
                totalTasks,
                tasksWithCompletions,
                tasksWithoutCompletions: totalTasks - tasksWithCompletions,
                avgCompletionsPerTask: Math.round(avgCompletionsPerTask * 100) / 100,
            },
        };
    }

    /**
     * Cron job: Сохранение статистики каждый день в полночь
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async saveDaily() {
        // Получаем все школы
        const schools = await this.tasksRepo
            .createQueryBuilder('task')
            .select('DISTINCT task.schoolId', 'schoolId')
            .getRawMany();

        for (const { schoolId } of schools) {
            const stats = await this.getStatistics(schoolId);

            const statistic = this.statisticsRepo.create({
                schoolId,
                date: new Date(),
                totalTasks: stats.totalTasks,
                completedTasks: stats.completedTasks,
                overdueTasks: stats.overdueTasks,
                urgentTasks: stats.urgentTasks,
                mediumPriorityTasks: stats.mediumPriorityTasks,
                lowPriorityTasks: stats.lowPriorityTasks,
                tasksByCategory: stats.tasksByCategory,
            });

            await this.statisticsRepo.save(statistic);
        }
    }
}
