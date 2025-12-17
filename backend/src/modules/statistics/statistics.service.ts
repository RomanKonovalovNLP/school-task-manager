import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from '../tasks/entities/task.entity';
import { TaskStatistic } from './entities/task-statistic.entity';

export interface StatisticsResponse {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    mediumPriorityTasks: number;
    lowPriorityTasks: number;
    tasksByCategory: Record<string, number>;
    tasksByPriority: {
        urgent: number;
        medium: number;
        low: number;
        overdue: number;
    };
    completionRate: number;
    avgCompletionTime: number | null;
}

export interface TrendData {
    date: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
}

@Injectable()
export class StatisticsService {
    constructor(
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
        @InjectRepository(TaskStatistic)
        private statisticsRepo: Repository<TaskStatistic>,
    ) {}

    /**
     * Получить общую статистику за период
     */
    async getStatistics(
        schoolId: number,
        startDate?: Date,
        endDate?: Date,
    ): Promise<StatisticsResponse> {
        const query = this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.assignees', 'assignees')
            .where('task.schoolId = :schoolId', { schoolId });

        if (startDate && endDate) {
            query.andWhere('task.createdAt BETWEEN :startDate AND :endDate', {
                startDate,
                endDate,
            });
        }

        const tasks = await query.getMany();

        // Подсчет статистики
        const totalTasks = tasks.length;
        const overdueTasks = tasks.filter((t) => t.isOverdue).length;
        
        // Подсчет по приоритетам
        const now = new Date();
        let urgentTasks = 0;
        let mediumPriorityTasks = 0;
        let lowPriorityTasks = 0;

        tasks.forEach((task) => {
            const hoursLeft = (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            if (task.isOverdue) return;
            
            if (hoursLeft <= 24) urgentTasks++;
            else if (hoursLeft <= 72) mediumPriorityTasks++;
            else lowPriorityTasks++;
        });

        // Подсчет по категориям
        const tasksByCategory: Record<string, number> = {};
        tasks.forEach((task) => {
            task.assignees?.forEach((assignee) => {
                const category = assignee.assigneeCategory;
                tasksByCategory[category] = (tasksByCategory[category] || 0) + 1;
            });
        });

        // Completion rate (пока заглушка, т.к. нет поля completed)
        const completedTasks = 0;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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
            avgCompletionTime: null,
        };
    }

    /**
     * Получить тренды за последние N дней
     */
    async getTrends(schoolId: number, days: number = 30): Promise<TrendData[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const statistics = await this.statisticsRepo.find({
            where: {
                schoolId,
                date: Between(startDate, endDate),
            },
            order: {
                date: 'ASC',
            },
        });

        return statistics.map((stat) => ({
            date: stat.date.toISOString().split('T')[0],
            totalTasks: stat.totalTasks,
            completedTasks: stat.completedTasks,
            overdueTasks: stat.overdueTasks,
        }));
    }

    /**
     * Получить статистику по категориям
     */
    async getCategoryStatistics(schoolId: number): Promise<{
        categories: Array<{
            name: string;
            count: number;
            percentage: number;
        }>;
    }> {
        const tasks = await this.tasksRepo.find({
            where: { schoolId },
            relations: ['assignees'],
        });

        const categoryCount: Record<string, number> = {};
        let totalAssignments = 0;

        tasks.forEach((task) => {
            task.assignees?.forEach((assignee) => {
                const category = assignee.assigneeCategory;
                categoryCount[category] = (categoryCount[category] || 0) + 1;
                totalAssignments++;
            });
        });

        const categories = Object.entries(categoryCount).map(([name, count]) => ({
            name,
            count,
            percentage: totalAssignments > 0 ? (count / totalAssignments) * 100 : 0,
        }));

        return { categories };
    }

    /**
     * Получить статистику по создателям
     */
    async getCreatorStatistics(schoolId: number): Promise<{
        creators: Array<{
            name: string;
            count: number;
            percentage: number;
        }>;
    }> {
        const tasks = await this.tasksRepo.find({
            where: { schoolId },
        });

        const creatorCount: Record<string, number> = {};
        
        tasks.forEach((task) => {
            const creator = task.creatorName;
            creatorCount[creator] = (creatorCount[creator] || 0) + 1;
        });

        const total = tasks.length;
        const creators = Object.entries(creatorCount).map(([name, count]) => ({
            name,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
        }));

        return { creators };
    }

    /**
     * Автоматическое сохранение статистики (каждый день в полночь)
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async saveStatistics() {
        console.log('📊 Сохранение статистики за день...');

        // Получаем все школы (упрощенная версия - нужно получить из базы)
        const schools = await this.tasksRepo
            .createQueryBuilder('task')
            .select('DISTINCT task.schoolId', 'schoolId')
            .getRawMany();

        for (const school of schools) {
            const stats = await this.getStatistics(school.schoolId);

            await this.statisticsRepo.save({
                schoolId: school.schoolId,
                date: new Date(),
                totalTasks: stats.totalTasks,
                completedTasks: stats.completedTasks,
                overdueTasks: stats.overdueTasks,
                urgentTasks: stats.urgentTasks,
                mediumPriorityTasks: stats.mediumPriorityTasks,
                lowPriorityTasks: stats.lowPriorityTasks,
                tasksByCategory: stats.tasksByCategory,
                avgCompletionTime: stats.avgCompletionTime,
            });
        }

        console.log('✅ Статистика сохранена');
    }
}
