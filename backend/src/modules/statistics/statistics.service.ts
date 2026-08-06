import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { TaskAssignee } from '../tasks/entities/task-assignee.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { TaskStatistic } from './entities/task-statistic.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
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
        @InjectRepository(UserCategory)
        private userCategoryRepo: Repository<UserCategory>,
        private notificationsService: NotificationsService,
        private notificationsGateway: NotificationsGateway,
    ) {}

    // ==================== Помощники подсчёта выполнения ====================

    /**
     * Карта: название категории → множество id профилей пользователей в ней.
     * Нужна, чтобы понять, сколько людей ДОЛЖНЫ выполнить задачу.
     */
    private async getCategoryUserMap(schoolId: number): Promise<Map<string, Set<number>>> {
        const rows = await this.userCategoryRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.category', 'cat')
            .where('cat.schoolId = :schoolId', { schoolId })
            .select('cat.categoryName', 'categoryName')
            .addSelect('uc.userProfileId', 'userProfileId')
            .getRawMany();

        const map = new Map<string, Set<number>>();
        for (const r of rows) {
            const name = r.categoryName;
            if (!map.has(name)) map.set(name, new Set());
            map.get(name)!.add(Number(r.userProfileId));
        }
        return map;
    }

    /**
     * Карта: id задачи → множество id профилей, отметивших её выполненной.
     */
    private async getTaskCompletionMap(schoolId: number): Promise<Map<number, Set<number>>> {
        const rows = await this.completionsRepo
            .createQueryBuilder('c')
            .innerJoin('c.task', 't')
            .where('t.schoolId = :schoolId', { schoolId })
            .select('c.taskId', 'taskId')
            .addSelect('c.userProfileId', 'userProfileId')
            .getRawMany();

        const map = new Map<number, Set<number>>();
        for (const r of rows) {
            const taskId = Number(r.taskId);
            if (!map.has(taskId)) map.set(taskId, new Set());
            map.get(taskId)!.add(Number(r.userProfileId));
        }
        return map;
    }

    /**
     * Ожидаемые исполнители задачи (id профилей).
     * Для личных задач исполнитель — только создатель (считаем как 1).
     */
    private getExpectedUserIds(task: Task, catMap: Map<string, Set<number>>, userMap: Map<string, number>): Set<number> {
        const ids = new Set<number>();
        for (const a of (task.assignees || [])) {
            if ((a as any).assigneeCategory) {
                const set = catMap.get((a as any).assigneeCategory);
                if (set) for (const id of set) ids.add(id);
            } else if ((a as any).assigneeUser) {
                const pid = userMap.get((a as any).assigneeUser);
                if (pid) ids.add(pid);
            }
        }
        return ids;
    }

    /** Карта ФИО → id профиля (для персональных назначений). */
    private async getUserProfileMap(schoolId: number): Promise<Map<string, number>> {
        const profiles = await this.userProfileRepo.find({ where: { schoolId } });
        const m = new Map<string, number>();
        for (const p of profiles) m.set(p.fullName, p.id);
        return m;
    }

    /**
     * Задача считается ВЫПОЛНЕННОЙ, только если её отметили ВСЕ ожидаемые исполнители,
     * а не хотя бы один. Для личных задач — если отметил создатель.
     */
    private isTaskFullyCompleted(
        task: Task,
        catMap: Map<string, Set<number>>,
        completionMap: Map<number, Set<number>>,
        userMap: Map<string, number>,
    ): boolean {
        const completed = completionMap.get(task.id) || new Set<number>();

        if ((task as any).isPersonal) {
            return completed.size >= 1;
        }

        const expected = this.getExpectedUserIds(task, catMap, userMap);
        if (expected.size === 0) return false; // некому выполнять — не считаем выполненной
        for (const id of expected) {
            if (!completed.has(id)) return false;
        }
        return true;
    }

    /** Количество ожидаемых исполнителей (для отображения доли). */
    private getExpectedCount(task: Task, catMap: Map<string, Set<number>>, userMap: Map<string, number>): number {
        if ((task as any).isPersonal) return 1;
        return this.getExpectedUserIds(task, catMap, userMap).size;
    }

    /**
     * Получить общую статистику
     */
    async getStatistics(schoolId: number, startDate?: string, endDate?: string) {
        const qb = this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.assignees', 'assignee')
            .where('task.schoolId = :schoolId', { schoolId })
            // Личные задачи — приватные заметки, в школьную статистику не входят
            .andWhere('task.isPersonal = false');

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

        // Подсчёт выполненных задач.
        // ИСПРАВЛЕНО: задача считается выполненной ТОЛЬКО когда её отметили ВСЕ
        // ожидаемые исполнители (а не хотя бы один).
        const catMap = await this.getCategoryUserMap(schoolId);
        const userMap = await this.getUserProfileMap(schoolId);
        const completionMap = await this.getTaskCompletionMap(schoolId);

        let completedTasks = 0;
        for (const task of tasks) {
            if (this.isTaskFullyCompleted(task, catMap, completionMap, userMap)) {
                completedTasks++;
            }
        }
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Статистика по категориям
        // ИСПРАВЛЕНО: строки персональных назначений имеют assigneeCategory = NULL,
        // без этого условия в разбивке появлялась «пустая» категория
        const categoryStats = await this.assigneesRepo
            .createQueryBuilder('assignee')
            .select('assignee.assigneeCategory', 'category')
            .addSelect('COUNT(DISTINCT assignee.taskId)', 'count')
            .innerJoin('tasks', 'task', 'task.id = assignee.taskId')
            .where('task.schoolId = :schoolId', { schoolId })
            .andWhere('task.is_personal = false')
            .andWhere('assignee.assigneeCategory IS NOT NULL')
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
            .andWhere('task.is_personal = false')
            // Персональные назначения (assigneeCategory = NULL) в разбивку по категориям не входят
            .andWhere('assignee.assigneeCategory IS NOT NULL')
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
            .andWhere('task.isPersonal = false')
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

        // ИСПРАВЛЕНО: одна выборка на всю школу вместо двух запросов на каждого
        // пользователя (было N+1). Личные задачи исключаем — их названия приватны.
        const completions = profiles.length
            ? await this.completionsRepo
                  .createQueryBuilder('c')
                  .innerJoinAndSelect('c.task', 't')
                  .where('t.schoolId = :schoolId', { schoolId })
                  .andWhere('t.isPersonal = false')
                  .andWhere('c.userProfileId IN (:...ids)', { ids: profiles.map((p) => p.id) })
                  .orderBy('c.completedAt', 'DESC')
                  .getMany()
            : [];

        const byUser = new Map<number, typeof completions>();
        for (const c of completions) {
            if (!byUser.has(c.userProfileId)) byUser.set(c.userProfileId, []);
            byUser.get(c.userProfileId)!.push(c);
        }

        const userStats = profiles.map((profile) => {
            const own = byUser.get(profile.id) || [];
            return {
                userId: profile.id,
                fullName: profile.fullName,
                completedTasksCount: own.length,
                recentCompletions: own.slice(0, 5).map((c) => ({
                    taskId: c.taskId,
                    taskTitle: c.task?.title || 'Удалённая задача',
                    completedAt: c.completedAt.toISOString(),
                })),
            };
        });

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
        // ИСПРАВЛЕНО: личные задачи — приватные заметки пользователей, их названия
        // не должны попадать в админский разрез (в списке задач админ их тоже не видит)
        const tasks = await this.tasksRepo.find({
            where: { schoolId, isPersonal: false } as any,
            relations: ['assignees'],
            order: { createdAt: 'DESC' },
        });

        // Карта категория→пользователи для подсчёта ожидаемых исполнителей
        const catMap = await this.getCategoryUserMap(schoolId);
        const userMap = await this.getUserProfileMap(schoolId);

        // ИСПРАВЛЕНО: отметки грузим одним запросом на все задачи (было N+1 —
        // отдельный запрос на каждую задачу)
        const allCompletions = tasks.length
            ? await this.completionsRepo.find({
                  where: { taskId: In(tasks.map((t) => t.id)) },
                  relations: ['userProfile'],
              })
            : [];
        const completionsByTask = new Map<number, typeof allCompletions>();
        for (const c of allCompletions) {
            if (!completionsByTask.has(c.taskId)) completionsByTask.set(c.taskId, []);
            completionsByTask.get(c.taskId)!.push(c);
        }

        // Для каждой задачи собираем статистику выполнения
        const taskStats = await Promise.all(
            tasks.map(async (task) => {
                const completions = completionsByTask.get(task.id) || [];

                // Категории задачи
                const categories = task.assignees?.filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory) || [];

                const completedBy = completions.map((c) => ({
                    fullName: c.userProfile.fullName,
                    completedAt: c.completedAt.toISOString(),
                }));

                // Сколько человек ДОЛЖНЫ выполнить задачу и выполнена ли она полностью
                const expectedCount = this.getExpectedCount(task, catMap, userMap);
                const isFullyCompleted =
                    expectedCount > 0 && completions.length >= expectedCount;

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
                    expectedCount,
                    isFullyCompleted,
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
        const fullyCompletedTasks = taskStats.filter((t) => t.isFullyCompleted).length;
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
                fullyCompletedTasks,
                avgCompletionsPerTask: Math.round(avgCompletionsPerTask * 100) / 100,
            },
        };
    }

    // ==================== НЕДЕЛЬНАЯ СТАТИСТИКА ====================

    /** Понедельник 00:00 той недели, в которую попадает дата */
    private startOfWeek(d: Date): Date {
        const date = new Date(d);
        const day = (date.getDay() + 6) % 7; // 0 = понедельник
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    private addDays(d: Date, days: number): Date {
        const date = new Date(d);
        date.setDate(date.getDate() + days);
        return date;
    }

    private formatWeekLabel(start: Date, end: Date): string {
        const fmt = (x: Date) =>
            x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
        return `${fmt(start)} – ${fmt(this.addDays(end, -1))}`;
    }

    /**
     * Статистика по неделям для админов: сколько задач создано,
     * сколько отметок о выполнении, сколько из них в срок, сколько людей работало.
     */
    async getWeeklyStatistics(schoolId: number, weeks = 8) {
        const currentWeekStart = this.startOfWeek(new Date());
        const firstWeekStart = this.addDays(currentWeekStart, -7 * (weeks - 1));

        // Задачи, созданные за период
        const createdRows = await this.tasksRepo
            .createQueryBuilder('task')
            .select('task.createdAt', 'createdAt')
            .addSelect('task.deadline', 'deadline')
            .where('task.schoolId = :schoolId', { schoolId })
            .andWhere('task.createdAt >= :from', { from: firstWeekStart })
            .getRawMany();

        // Отметки о выполнении за период (с дедлайном задачи — чтобы понять «в срок»)
        const completionRows = await this.completionsRepo
            .createQueryBuilder('c')
            .innerJoin('c.task', 't')
            .select('c.completedAt', 'completedAt')
            .addSelect('c.userProfileId', 'userProfileId')
            .addSelect('t.deadline', 'deadline')
            .where('t.schoolId = :schoolId', { schoolId })
            .andWhere('c.completedAt >= :from', { from: firstWeekStart })
            .getRawMany();

        // Дедлайны, приходящиеся на период
        const deadlineRows = await this.tasksRepo
            .createQueryBuilder('task')
            .select('task.deadline', 'deadline')
            .where('task.schoolId = :schoolId', { schoolId })
            .andWhere('task.deadline >= :from', { from: firstWeekStart })
            .getRawMany();

        const result: any[] = [];

        for (let i = 0; i < weeks; i++) {
            const start = this.addDays(firstWeekStart, i * 7);
            const end = this.addDays(start, 7);
            const inRange = (v: any) => {
                const t = new Date(v).getTime();
                return t >= start.getTime() && t < end.getTime();
            };

            const created = createdRows.filter((r) => inRange(r.createdAt)).length;
            const deadlines = deadlineRows.filter((r) => inRange(r.deadline)).length;

            const weekCompletions = completionRows.filter((r) => inRange(r.completedAt));
            const completions = weekCompletions.length;
            const onTime = weekCompletions.filter(
                (r) => new Date(r.completedAt).getTime() <= new Date(r.deadline).getTime(),
            ).length;
            const activeUsers = new Set(weekCompletions.map((r) => Number(r.userProfileId))).size;

            result.push({
                weekStart: start.toISOString(),
                weekEnd: this.addDays(end, -1).toISOString(),
                label: this.formatWeekLabel(start, end),
                isCurrent: start.getTime() === currentWeekStart.getTime(),
                createdTasks: created,
                deadlines,
                completions,
                onTimeCompletions: onTime,
                lateCompletions: completions - onTime,
                onTimeRate: completions > 0 ? Math.round((onTime / completions) * 100) : 0,
                activeUsers,
            });
        }

        // Сравнение двух последних завершённых недель
        const finished = result.filter((w) => !w.isCurrent);
        const last = finished[finished.length - 1];
        const prev = finished[finished.length - 2];

        return {
            weeks: result,
            summary: {
                lastWeekCompletions: last?.completions ?? 0,
                prevWeekCompletions: prev?.completions ?? 0,
                deltaCompletions: (last?.completions ?? 0) - (prev?.completions ?? 0),
                lastWeekOnTimeRate: last?.onTimeRate ?? 0,
                bestWeekLabel:
                    result.length > 0
                        ? result.reduce((a, b) => (b.completions > a.completions ? b : a)).label
                        : null,
            },
        };
    }

    /**
     * Персональная сводка пользователя за неделю (для мотивационного дайджеста).
     */
    async getUserWeeklySummary(profileId: number, weekStart: Date, weekEnd: Date) {
        const rows = await this.completionsRepo
            .createQueryBuilder('c')
            .innerJoin('c.task', 't')
            .select('c.completedAt', 'completedAt')
            .addSelect('t.deadline', 'deadline')
            .where('c.userProfileId = :profileId', { profileId })
            .andWhere('c.completedAt >= :start', { start: weekStart })
            .andWhere('c.completedAt < :end', { end: weekEnd })
            .getRawMany();

        const completed = rows.length;
        const onTime = rows.filter(
            (r) => new Date(r.completedAt).getTime() <= new Date(r.deadline).getTime(),
        ).length;

        // Активные дни недели — по ним считаем «серию»
        const days = new Set(rows.map((r) => new Date(r.completedAt).toDateString()));

        return {
            completed,
            onTime,
            late: completed - onTime,
            onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
            activeDays: days.size,
        };
    }

    /**
     * Cron: каждый понедельник в 6:00 отправляем каждому пользователю
     * персональную сводку за прошлую неделю — для мотивации.
     */
    @Cron('0 6 * * 1')
    async sendWeeklyDigests() {
        const thisWeekStart = this.startOfWeek(new Date());
        const lastWeekStart = this.addDays(thisWeekStart, -7);
        const weekBeforeStart = this.addDays(thisWeekStart, -14);

        const profiles = await this.userProfileRepo.find();

        for (const profile of profiles) {
            try {
                const cur = await this.getUserWeeklySummary(profile.id, lastWeekStart, thisWeekStart);
                const prev = await this.getUserWeeklySummary(profile.id, weekBeforeStart, lastWeekStart);

                const message = this.buildDigestMessage(cur, prev, lastWeekStart, thisWeekStart);

                const saved = await this.notificationsService.createUserNotification(
                    profile.schoolId,
                    [profile.fullName],
                    null,
                    NotificationType.WEEKLY_DIGEST,
                    message,
                );

                if (saved && saved.length) {
                    this.notificationsGateway.sendNotificationToUsers(
                        profile.schoolId,
                        [profile.fullName],
                        { ...saved[0], createdAt: new Date().toISOString() },
                    );
                }
            } catch (e) {
                // Один сбойный пользователь не должен ломать рассылку остальным
                console.error(`Не удалось отправить недельную сводку для ${profile.fullName}:`, e);
            }
        }
    }

    /** Текст мотивационной сводки */
    private buildDigestMessage(
        cur: { completed: number; onTime: number; onTimeRate: number; activeDays: number },
        prev: { completed: number },
        weekStart: Date,
        weekEnd: Date,
    ): string {
        const period = this.formatWeekLabel(weekStart, weekEnd);

        if (cur.completed === 0) {
            return `Итоги недели (${period}): выполненных задач пока нет. Новая неделя, хороший момент начать: загляните в раздел «Сегодня» и выберите первую задачу.`;
        }

        const parts: string[] = [
            `Итоги недели (${period}): выполнено задач ${cur.completed}, из них в срок ${cur.onTime} (${cur.onTimeRate}%).`,
        ];

        // Отмечаем только рост или стабильность: снижение может быть просто из-за
        // того, что задач на неделе было меньше, — упрекать за это некорректно.
        const delta = cur.completed - prev.completed;
        if (prev.completed > 0 && delta > 0) {
            parts.push(`Это на ${delta} больше, чем неделей раньше. Отличная динамика!`);
        } else if (prev.completed > 0 && delta === 0) {
            parts.push('Тот же результат, что и неделей раньше. Темп держите стабильно.');
        }

        if (cur.onTimeRate === 100) {
            parts.push('Все задачи закрыты вовремя. Так держать!');
        }
        if (cur.activeDays >= 5) {
            parts.push(`Вы работали над задачами ${cur.activeDays} дней из 7.`);
        }

        return parts.join(' ');
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const { schoolId } of schools) {
            const stats = await this.getStatistics(schoolId);

            // ИСПРАВЛЕНО: на одну дату — одна запись. Раньше повторный запуск
            // (перезапуск сервиса, второй экземпляр) создавал дубли,
            // и в графике трендов появлялись две точки за один день.
            const existing = await this.statisticsRepo.findOne({
                where: { schoolId, date: today as any },
            });

            const payload = {
                schoolId,
                date: today,
                totalTasks: stats.totalTasks,
                completedTasks: stats.completedTasks,
                overdueTasks: stats.overdueTasks,
                urgentTasks: stats.urgentTasks,
                mediumPriorityTasks: stats.mediumPriorityTasks,
                lowPriorityTasks: stats.lowPriorityTasks,
                tasksByCategory: stats.tasksByCategory,
            };

            await this.statisticsRepo.save(
                existing ? this.statisticsRepo.merge(existing, payload) : this.statisticsRepo.create(payload),
            );
        }
    }
}
