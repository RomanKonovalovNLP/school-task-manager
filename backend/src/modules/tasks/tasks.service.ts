import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskView } from './entities/task-view.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskGroup } from './entities/task-group.entity';
import { TaskGroupItem } from './entities/task-group-item.entity';
import { TaskFocus } from './entities/task-focus.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Директория для загрузок
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'tasks');

// Вспомогательная функция для получения пути к файлу
function getFilePath(fileName: string): string {
    return path.join(UPLOADS_DIR, fileName);
}

@Injectable()
export class TasksService {
    constructor(
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
        @InjectRepository(TaskAssignee)
        private assigneesRepo: Repository<TaskAssignee>,
        @InjectRepository(TaskView)
        private viewsRepo: Repository<TaskView>,
        @InjectRepository(TaskCompletion)
        private completionsRepo: Repository<TaskCompletion>,
        @InjectRepository(TaskAttachment)
        private attachmentsRepo: Repository<TaskAttachment>,
        @InjectRepository(TaskGroup)
        private taskGroupRepo: Repository<TaskGroup>,
        @InjectRepository(TaskGroupItem)
        private taskGroupItemRepo: Repository<TaskGroupItem>,
        @InjectRepository(TaskFocus)
        private taskFocusRepo: Repository<TaskFocus>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
        @InjectRepository(UserCategory)
        private userCategoryRepo: Repository<UserCategory>,
        private notificationsService: NotificationsService,
        private notificationsGateway: NotificationsGateway,
    ) {
        // Создаём директорию для загрузок если её нет
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
    }

    /**
     * ИСПРАВЛЕНО (#1): категории пользователя загружаются из профиля.
     * Раньше findAll читал user.categories, которые SchoolAuthGuard не заполняет,
     * из-за чего categoryOnly-задачи были невидимы назначенным пользователям.
     */
    private async getUserCategories(schoolId: number, fullName: string): Promise<string[]> {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });
        if (!profile) return [];

        const userCategories = await this.userCategoryRepo.find({
            where: { userProfileId: profile.id },
            relations: ['category'],
        });

        return userCategories
            .filter((uc) => uc.category)
            .map((uc) => uc.category.categoryName);
    }

    /**
     * ИСПРАВЛЕНО (#2, #3): единая проверка видимости задачи.
     * Личные — только создателю (по creatorName: сравнение по creatorId===sessionId
     * ломалось после logout, т.к. сессия удаляется и id меняется).
     * categoryOnly — админам, создателю и пользователям назначенных категорий.
     */
    private taskVisibleTo(task: Task, user: any, userCategories: string[]): boolean {
        if ((task as any).isPersonal) {
            return task.creatorName === user.fullName;
        }
        if ((task as any).categoryOnly && !user.isAdmin && task.creatorName !== user.fullName) {
            const taskCategories = task.assignees?.filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory) || [];
            const taskUsers = task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser as string) || [];
            return taskCategories.some((c) => userCategories.includes(c)) || taskUsers.includes(user.fullName);
        }
        return true;
    }

    /**
     * Создание задачи
     */
    async create(createTaskDto: CreateTaskDto, user: any): Promise<Task> {
        const rec = createTaskDto.recurrence && createTaskDto.recurrence !== 'none' ? createTaskDto.recurrence : null;
        const dates = this.buildOccurrenceDates(new Date(createTaskDto.deadline), rec, createTaskDto.recurrenceUntil);

        // Серия сохраняется пакетно: при длинных повторениях (учебный год)
        // это сотни задач, и вставка по одной была бы очень медленной
        const cats = createTaskDto.assigneeCategories || [];
        const usersList = createTaskDto.assigneeUsers || [];

        const newTasks = dates.map((d) =>
            this.tasksRepo.create({
                schoolId: user.schoolId,
                title: createTaskDto.title,
                description: createTaskDto.description,
                deadline: d,
                creatorName: user.fullName,
                creatorId: user.sessionId,
                isPersonal: createTaskDto.isPersonal || false,
                categoryOnly: createTaskDto.categoryOnly || false,
                restrictAttachments: createTaskDto.restrictAttachments || false,
                isImportant: createTaskDto.isImportant || false,
                recurrence: rec ?? undefined,
            }),
        );

        const savedTasks = await this.tasksRepo.save(newTasks, { chunk: 100 });
        const firstTask: Task | null = savedTasks[0] ?? null;

        if (!createTaskDto.isPersonal && (cats.length > 0 || usersList.length > 0)) {
            const assignees = savedTasks.flatMap((t) => [
                ...cats.map((category) => this.assigneesRepo.create({ taskId: t.id, assigneeCategory: category })),
                ...usersList.map((u) => this.assigneesRepo.create({ taskId: t.id, assigneeUser: u })),
            ]);
            if (assignees.length) {
                await this.assigneesRepo.save(assignees, { chunk: 200 });
            }
        }

        // Уведомление — одно на серию (категориям и конкретным пользователям)
        const cats0 = createTaskDto.assigneeCategories || [];
        const users0 = createTaskDto.assigneeUsers || [];

        // Личная задача: уведомляем самого автора — раньше по личным задачам
        // не приходило ничего, и запись о них не попадала в колокольчик
        if (firstTask && createTaskDto.isPersonal) {
            const suffix = dates.length > 1 ? ` (серия из ${dates.length})` : '';
            const msg = `Новая личная задача: ${firstTask.title}${suffix}`;
            const un = await this.notificationsService.createUserNotification(
                user.schoolId, [user.fullName], firstTask.id, NotificationType.NEW_TASK, msg,
            );
            this.notificationsGateway.broadcastTaskCreated(user.schoolId, {
                ...firstTask,
                assigneeCategories: [],
                assigneeUsers: [],
            });
            if (un && un.length) {
                this.notificationsGateway.sendNotificationToUsers(
                    user.schoolId, [user.fullName], { ...un[0], createdAt: new Date().toISOString() },
                );
            }
        }

        if (firstTask && !createTaskDto.isPersonal && (cats0.length > 0 || users0.length > 0)) {
            const suffix = dates.length > 1 ? ` (серия из ${dates.length})` : '';
            const msg = `Новая задача: ${firstTask.title}${suffix}`;
            // Персональные адресаты, не покрытые назначенными категориями (чтобы не было дублей)
            const users0eff = await this.notificationsService.filterUncoveredUsers(user.schoolId, users0, cats0);
            let firstNotif: any = null;
            if (cats0.length > 0) {
                const n = await this.notificationsService.createNotification(user.schoolId, cats0, firstTask.id, NotificationType.NEW_TASK, msg);
                if (n && n.length) firstNotif = n[0];
            }
            if (users0eff.length > 0) {
                const un = await this.notificationsService.createUserNotification(user.schoolId, users0eff, firstTask.id, NotificationType.NEW_TASK, msg);
                if (!firstNotif && un && un.length) firstNotif = un[0];
            }
            this.notificationsGateway.broadcastTaskCreated(user.schoolId, {
                ...firstTask,
                assigneeCategories: cats0,
                assigneeUsers: users0,
            });
            if (firstNotif) {
                const payload = { ...firstNotif, createdAt: new Date().toISOString() };
                if (cats0.length > 0) this.notificationsGateway.sendUniqueNotificationToCategories(user.schoolId, cats0, payload);
                if (users0eff.length > 0) this.notificationsGateway.sendNotificationToUsers(user.schoolId, users0eff, payload);
            }
        }

        return this.findOne(firstTask!.id, user);
    }

    /**
     * ИСПРАВЛЕНО (#8): месячный повтор считается от базовой даты с ограничением
     * дня по длине месяца. Раньше setMonth(+1) от 31 января давал 2–3 марта
     * (февраль пропускался, дата съезжала до конца серии).
     */
    private addMonthsClamped(base: Date, months: number): Date {
        const d = new Date(base);
        const day = base.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + months);
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, daysInMonth));
        return d;
    }

    /** Даты повторов серии (включая базовую). Без даты окончания — 12 повторов, максимум 60. */
    /**
     * Конец учебного года — 31 мая.
     * Январь–май: 31 мая текущего года (идёт второе полугодие).
     * Июнь–декабрь: 31 мая следующего года (планируем на предстоящий учебный год).
     */
    private endOfAcademicYear(base: Date): Date {
        const year = base.getMonth() <= 4 ? base.getFullYear() : base.getFullYear() + 1;
        return new Date(year, 4, 31, 23, 59, 59, 999); // 4 = май
    }

    /**
     * Даты повторений серии.
     *
     * Лимит рассчитан так, чтобы спокойно помещался весь учебный год:
     * ежедневно — до 366 задач, еженедельно — до 53, ежемесячно — до 12.
     * Если дата окончания не указана, серия строится до 31 мая — конца учебного года.
     */
    private buildOccurrenceDates(base: Date, rec: string | null, untilStr?: string): Date[] {
        if (!rec) return [base];

        const MAX_BY_REC: Record<string, number> = { daily: 366, weekly: 53, monthly: 12 };
        const maxCount = MAX_BY_REC[rec] ?? 60;

        let until: Date;
        if (untilStr) {
            until = new Date(untilStr);
            until.setHours(23, 59, 59, 999);
        } else {
            // Без явной даты окончания — до конца учебного года
            until = this.endOfAcademicYear(base);
        }

        const dates: Date[] = [new Date(base)];
        let d = new Date(base);

        while (dates.length < maxCount) {
            let next: Date;
            if (rec === 'daily') { next = new Date(d); next.setDate(next.getDate() + 1); }
            else if (rec === 'weekly') { next = new Date(d); next.setDate(next.getDate() + 7); }
            else if (rec === 'monthly') { next = this.addMonthsClamped(base, dates.length); }
            else break;

            if (next.getTime() > until.getTime()) break;
            dates.push(next);
            d = next;
        }

        return dates;
    }

    /** Cron: напоминания за ~сутки и ~час до дедлайна. */
    @Cron(CronExpression.EVERY_30_MINUTES)
    async sendDeadlineReminders() {
        const now = new Date();
        const in24 = new Date(now.getTime() + 24 * 3600 * 1000);
        const tasks = await this.tasksRepo.find({ where: { deadline: Between(now, in24) }, relations: ['assignees'] });
        for (const t of tasks) {
            const hoursLeft = (new Date(t.deadline).getTime() - now.getTime()) / 3600000;
            let when: string | null = null;
            if (hoursLeft <= 1 && !(t as any).remind1Sent) { when = 'менее чем через час'; (t as any).remind1Sent = true; (t as any).remind24Sent = true; }
            else if (hoursLeft <= 24 && !(t as any).remind24Sent) { when = 'менее чем через сутки'; (t as any).remind24Sent = true; }
            if (!when) continue;
            const cats = (t.assignees || []).filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory);
            const usrs = (t.assignees || []).filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser as string);

            // Личная задача: напоминаем её автору — раньше по личным задачам
            // напоминания не приходили вообще
            if ((t as any).isPersonal) {
                const msg = `Скоро дедлайн: "${t.title}" — ${when}`;
                const un = await this.notificationsService.createUserNotification(
                    t.schoolId, [t.creatorName], t.id, NotificationType.DEADLINE_CHANGED, msg,
                );
                if (un && un.length) {
                    this.notificationsGateway.sendNotificationToUsers(
                        t.schoolId, [t.creatorName], { ...un[0], createdAt: new Date().toISOString() },
                    );
                }
            }

            if ((cats.length || usrs.length) && !(t as any).isPersonal) {
                const msg = `Скоро дедлайн: "${t.title}" — ${when}`;
                if (cats.length) {
                    const notifs = await this.notificationsService.createNotification(t.schoolId, cats, t.id, NotificationType.DEADLINE_CHANGED, msg);
                    if (notifs && notifs.length) this.notificationsGateway.sendUniqueNotificationToCategories(t.schoolId, cats, { ...notifs[0], createdAt: new Date().toISOString() });
                }
                const usrsEff = await this.notificationsService.filterUncoveredUsers(t.schoolId, usrs, cats);
                if (usrsEff.length) {
                    const un = await this.notificationsService.createUserNotification(t.schoolId, usrsEff, t.id, NotificationType.DEADLINE_CHANGED, msg);
                    if (un && un.length) this.notificationsGateway.sendNotificationToUsers(t.schoolId, usrsEff, { ...un[0], createdAt: new Date().toISOString() });
                }
            }
            await this.tasksRepo.save(t);
        }
    }

    /**
     * Получение всех задач
     */
    async findAll(user: any, filters: TaskFilterDto): Promise<Task[]> {
        const qb = this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.assignees', 'assignee')
            .leftJoinAndSelect('task.views', 'view')
            .where('task.schoolId = :schoolId', { schoolId: user.schoolId });

        // Фильтр по категории (несколько — через запятую, задача попадает по любой из них).
        // Спец-значения: __forme__ (мои категории + лично мне), __personal__ (все адресные, только админ)
        if (filters.category) {
            const cats = String(filters.category).split(',').map((c) => c.trim()).filter(Boolean);
            const realCats = cats.filter((c) => c !== '__forme__' && c !== '__personal__');
            const wantForMe = cats.includes('__forme__');
            const wantPersonal = user.isAdmin && cats.includes('__personal__');
            const conditions: string[] = [];
            const params: any = {};
            if (realCats.length) { conditions.push('assignee.assigneeCategory IN (:...realCats)'); params.realCats = realCats; }
            if (wantForMe) {
                const myCats = await this.getUserCategories(user.schoolId, user.fullName);
                const parts = ['assignee.assigneeUser = :me'];
                params.me = user.fullName;
                if (myCats.length) { parts.push('assignee.assigneeCategory IN (:...myCats)'); params.myCats = myCats; }
                conditions.push('(' + parts.join(' OR ') + ')');
            }
            if (wantPersonal) { conditions.push('assignee.assigneeUser IS NOT NULL'); }
            if (conditions.length) {
                qb.andWhere('(' + conditions.join(' OR ') + ')', params);
            }
        }

        // Фильтр по создателю
        if (filters.creatorName) {
            qb.andWhere('task.creatorName = :creatorName', {
                creatorName: filters.creatorName,
            });
        }

        qb.orderBy('task.deadline', 'ASC');

        const tasks = await qb.getMany();

        // FIX #2: Фильтрация по видимости
        const showShared = filters.showShared !== 'false';
        const showPersonal = filters.showPersonal !== 'false';
        // ИСПРАВЛЕНО (#1): загружаем категории из профиля (guard их не передаёт)
        const userCategories = await this.getUserCategories(user.schoolId, user.fullName);

        let filtered = tasks.filter((task) => this.taskVisibleTo(task, user, userCategories));

        // FIX #3: Фильтры Общие/Личные
        if (!showShared && !showPersonal) {
            filtered = [];
        } else if (!showShared) {
            filtered = filtered.filter(t => (t as any).isPersonal);
        } else if (!showPersonal) {
            filtered = filtered.filter(t => !(t as any).isPersonal);
        }

        // Вычисляем приоритет и добавляем дополнительные данные
        let enriched = filtered.map((task) => this.enrichTask(task, user));

        // Фильтр по приоритету (вычисляется из дедлайна, поэтому фильтруем после enrich)
        if (filters.priority) {
            const prios = String(filters.priority).split(',').map((p) => p.trim()).filter(Boolean);
            if (prios.length) {
                enriched = enriched.filter((t: any) => prios.some((p) => (p === 'important' ? t.isImportant : t.priority === p)));
            }
        }

        // Статусы выполнения — нужны для подсветки и фильтров «скрыть выполненные»
        return this.attachCompletionFlags(enriched, user);
    }

    /**
     * Получение одной задачи
     */
    async findOne(id: number, user: any): Promise<Task> {
        const task = await this.tasksRepo.findOne({
            where: { id, schoolId: user.schoolId },
            relations: ['assignees', 'views', 'attachments'],
        });

        if (!task) {
            throw new NotFoundException('Задача не найдена');
        }

        // ИСПРАВЛЕНО (#2): проверка видимости и для точечного запроса —
        // раньше чужую личную задачу можно было открыть по ID.
        // Категории загружаем только когда они действительно нужны.
        if ((task as any).isPersonal || (task as any).categoryOnly) {
            const userCategories = (task as any).categoryOnly
                ? await this.getUserCategories(user.schoolId, user.fullName)
                : [];
            if (!this.taskVisibleTo(task, user, userCategories)) {
                // Отдаём 404, а не 403 — не раскрываем сам факт существования задачи
                throw new NotFoundException('Задача не найдена');
            }
        }

        const [withFlags] = await this.attachCompletionFlags([this.enrichTask(task, user)], user);
        return withFlags;
    }

    /**
     * Обновление задачи
     */
    async update(id: number, updateTaskDto: UpdateTaskDto, user: any): Promise<Task> {
        const task = await this.findOne(id, user);

        // Проверяем права
        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав для редактирования этой задачи');
        }

        const deadlineChanged =
            updateTaskDto.deadline &&
            new Date(updateTaskDto.deadline).getTime() !== new Date(task.deadline).getTime();

        // Обновляем задачу
        Object.assign(task, {
            title: updateTaskDto.title ?? task.title,
            description: updateTaskDto.description ?? task.description,
            deadline: updateTaskDto.deadline ? new Date(updateTaskDto.deadline) : task.deadline,
            isPersonal: updateTaskDto.isPersonal ?? (task as any).isPersonal,
            categoryOnly: updateTaskDto.categoryOnly ?? (task as any).categoryOnly,
            restrictAttachments: updateTaskDto.restrictAttachments ?? (task as any).restrictAttachments,
            isImportant: updateTaskDto.isImportant ?? (task as any).isImportant,
        });

        if (deadlineChanged) { (task as any).remind24Sent = false; (task as any).remind1Sent = false; }

        await this.tasksRepo.save(task);

        // Обновляем assignees если переданы
        if (updateTaskDto.assigneeCategories !== undefined || (updateTaskDto as any).assigneeUsers !== undefined) {
            await this.assigneesRepo.delete({ taskId: id });
            const assignees = [
                ...((updateTaskDto.assigneeCategories || []).map((category) =>
                    this.assigneesRepo.create({ taskId: id, assigneeCategory: category }))),
                ...(((updateTaskDto as any).assigneeUsers || []).map((u: string) =>
                    this.assigneesRepo.create({ taskId: id, assigneeUser: u }))),
            ];
            if (assignees.length) await this.assigneesRepo.save(assignees);
        }

        // Отправляем уведомления
        const categories = updateTaskDto.assigneeCategories ||
            task.assignees?.filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory) || [];
        const users = (updateTaskDto as any).assigneeUsers ||
            task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser) || [];

        if (deadlineChanged) {
            const msg = `Изменён дедлайн задачи: ${task.title}`;
            // Персональные адресаты, не покрытые назначенными категориями (чтобы не было дублей)
            const usersEff = await this.notificationsService.filterUncoveredUsers(user.schoolId, users, categories);

            if (categories.length > 0) {
                const notifications = await this.notificationsService.createNotification(
                    user.schoolId,
                    categories,
                    id,
                    NotificationType.DEADLINE_CHANGED,
                    msg,
                );
                // Реал-тайм уведомление в колокольчик получателям
                if (notifications && notifications.length > 0) {
                    this.notificationsGateway.sendUniqueNotificationToCategories(
                        user.schoolId,
                        categories,
                        { ...notifications[0], createdAt: new Date().toISOString() },
                    );
                }
            }

            if (usersEff.length > 0) {
                const un = await this.notificationsService.createUserNotification(
                    user.schoolId,
                    usersEff,
                    id,
                    NotificationType.DEADLINE_CHANGED,
                    msg,
                );
                if (un && un.length > 0) {
                    this.notificationsGateway.sendNotificationToUsers(
                        user.schoolId,
                        usersEff,
                        { ...un[0], createdAt: new Date().toISOString() },
                    );
                }
            }
        }

        // ИСПРАВЛЕНО (#4): рассылаем свежую версию задачи с актуальными
        // assigneeCategories — gateway фильтрует получателей личных/categoryOnly задач
        const updated = await this.findOne(id, user);
        this.notificationsGateway.broadcastTaskUpdate(user.schoolId, updated);

        return updated;
    }

    /**
     * Удаление задачи
     */
    async remove(id: number, user: any): Promise<{ message: string }> {
        const task = await this.findOne(id, user);

        if (!user.isAdmin && task.creatorName !== user.fullName) {
            throw new ForbiddenException('Нет прав для удаления этой задачи');
        }

        const categories = task.assignees?.map((a) => a.assigneeCategory) || [];

        // Удаляем вложения с диска
        const attachments = await this.attachmentsRepo.find({ where: { taskId: id } });
        for (const attachment of attachments) {
            const filePath = getFilePath(attachment.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await this.tasksRepo.remove(task);

        // Уведомляем
        this.notificationsGateway.broadcastTaskDelete(user.schoolId, id);

        return { message: 'Задача удалена' };
    }

    /**
     * Удаление просроченных задач
     */
    async removeOverdue(user: any): Promise<{ message: string; count: number }> {
        // M9: isOverdue никогда не обновляется в БД. Используем сравнение дат.
        // ИСПРАВЛЕНО: чужие личные задачи не удаляются — только общие задачи
        // школы и собственные личные задачи вызывающего.
        const overdueTasks = await this.tasksRepo
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.attachments', 'attachments')
            .where('task.schoolId = :schoolId', { schoolId: user.schoolId })
            .andWhere('task.deadline < NOW()')
            .andWhere('(task.isPersonal = false OR task.creatorName = :fullName)', {
                fullName: user.fullName,
            })
            .getMany();

        // Удаляем вложения с диска
        for (const task of overdueTasks) {
            for (const attachment of task.attachments || []) {
                const filePath = getFilePath(attachment.fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        await this.tasksRepo.remove(overdueTasks);

        return {
            message: 'Просроченные задачи удалены',
            count: overdueTasks.length,
        };
    }

    /**
     * Отметить задачу как просмотренную
     */
    async markAsViewed(id: number, user: any): Promise<{ success: boolean }> {
        const task = await this.findOne(id, user);

        const existingView = await this.viewsRepo.findOne({
            where: { taskId: id, viewerName: user.fullName },
        });

        if (!existingView) {
            const view = this.viewsRepo.create({
                taskId: id,
                viewerName: user.fullName,
            });
            await this.viewsRepo.save(view);
        }

        return { success: true };
    }

    /**
     * Получить просмотры задачи
     */
    async getViews(id: number, user: any): Promise<{ taskId: number; viewsCount: number; views: TaskView[] }> {
        const task = await this.findOne(id, user);

        const views = await this.viewsRepo.find({
            where: { taskId: id },
            order: { viewedAt: 'DESC' },
        });

        // ИСПРАВЛЕНО: имена просмотревших видят только создатель задачи и админ —
        // в интерфейсе блок и так скрыт, но API отдавал список кому угодно
        const canSeeNames = user.isAdmin || task.creatorName === user.fullName;

        return {
            taskId: id,
            viewsCount: views.length,
            views: canSeeNames ? views : [],
        };
    }

    /**
     * Переключить выполнение задачи
     */
    async toggleCompletion(id: number, user: any): Promise<{ completed: boolean }> {
        await this.findOne(id, user);

        // Получаем или создаём профиль пользователя
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

        const existing = await this.completionsRepo.findOne({
            where: { taskId: id, userProfileId: profile.id },
        });

        if (existing) {
            await this.completionsRepo.remove(existing);
            return { completed: false };
        } else {
            const completion = this.completionsRepo.create({
                taskId: id,
                userProfileId: profile.id,
            });
            await this.completionsRepo.save(completion);
            return { completed: true };
        }
    }

    /**
     * Проверить, выполнена ли задача пользователем
     */
    async isCompletedByUser(id: number, user: any): Promise<boolean> {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });

        if (!profile) return false;

        const completion = await this.completionsRepo.findOne({
            where: { taskId: id, userProfileId: profile.id },
        });

        return !!completion;
    }

    /**
     * Получить количество выполнивших задачу
     */
    async getCompletionCount(id: number): Promise<number> {
        return this.completionsRepo.count({ where: { taskId: id } });
    }

    /**
     * НОВОЕ: Получить детальный статус выполнения
     * Для создателя и админа показывает имена выполнивших
     */
    async getCompletionStatusDetailed(id: number, user: any): Promise<{
        completed: boolean;
        completionCount: number;
        completedBy?: { fullName: string; completedAt: string }[];
    }> {
        const task = await this.findOne(id, user);
        const completed = await this.isCompletedByUser(id, user);
        const count = await this.getCompletionCount(id);

        const result: any = { completed, completionCount: count };

        // Если пользователь - создатель или админ, показываем имена
        if (user.isAdmin || task.creatorName === user.fullName) {
            const completions = await this.completionsRepo.find({
                where: { taskId: id },
                relations: ['userProfile'],
                order: { completedAt: 'DESC' },
            });

            result.completedBy = completions.map((c) => ({
                fullName: c.userProfile.fullName,
                completedAt: c.completedAt.toISOString(),
            }));
        }

        return result;
    }

    // ==================== ВЛОЖЕНИЯ ====================

    /**
     * Загрузить вложение
     */
    async uploadAttachment(id: number, file: any, user: any): Promise<TaskAttachment> {
        const task = await this.findOne(id, user);

        if (!file) {
            throw new BadRequestException('Файл не был загружен');
        }

        // Генерируем уникальное имя файла
        const ext = path.extname(file.originalname);
        const fileName = `${uuidv4()}${ext}`;
        const filePath = path.join(UPLOADS_DIR, fileName);

        // Сохраняем файл
        fs.writeFileSync(filePath, file.buffer);

        // ИСПРАВЛЕНИЕ: Сохраняем оригинальное имя в UTF-8
        // Декодируем имя файла если оно пришло в неправильной кодировке
        let originalName = file.originalname;
        try {
            // Проверяем, не закодировано ли имя в latin1
            const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
            // Если декодирование дало валидный UTF-8 без replacement characters
            if (decoded && !decoded.includes('�') && decoded !== originalName) {
                // Проверяем что это действительно была проблема кодировки
                const reEncoded = Buffer.from(decoded, 'utf8').toString('latin1');
                if (reEncoded === originalName) {
                    originalName = decoded;
                }
            }
        } catch (e) {
            // Оставляем как есть
        }

        // Файл считается «публичным шаблоном», если его загрузил создатель
        // задачи или администратор — такие файлы видны всем даже при ограничении.
        const uploaderIsPrivileged =
            !!user.isAdmin || task.creatorName === user.fullName;

        const attachment = this.attachmentsRepo.create({
            taskId: id,
            fileName,
            originalName,
            mimeType: file.mimetype,
            fileSize: file.size,
            uploaderName: user.fullName,
            uploaderIsPrivileged,
        });

        return this.attachmentsRepo.save(attachment);
    }

    /**
     * Может ли пользователь видеть конкретное вложение.
     * Если у задачи не включено ограничение (restrictAttachments) — видят все.
     * Если включено — вложения обычных пользователей видны только:
     *   - администраторам,
     *   - создателю задачи,
     *   - самому загрузившему файл.
     * Вложения создателя/админа (uploaderIsPrivileged) видны всем.
     */
    private canSeeAttachment(task: any, attachment: TaskAttachment, user: any): boolean {
        if (!task?.restrictAttachments) return true;
        if (attachment.uploaderIsPrivileged) return true;
        if (user.isAdmin) return true;
        if (task.creatorName === user.fullName) return true;
        if (attachment.uploaderName === user.fullName) return true;
        return false;
    }

    /**
     * Получить вложения задачи
     */
    async getAttachments(id: number, user: any): Promise<TaskAttachment[]> {
        const task = await this.findOne(id, user);

        const attachments = await this.attachmentsRepo.find({
            where: { taskId: id },
            order: { uploadedAt: 'DESC' },
        });

        return attachments.filter((a) => this.canSeeAttachment(task, a, user));
    }

    /**
     * Скачать вложение
     */
    async downloadAttachment(
        taskId: number,
        attachmentId: number,
        user: any,
    ): Promise<TaskAttachment> {
        const task = await this.findOne(taskId, user);

        const attachment = await this.attachmentsRepo.findOne({
            where: { id: attachmentId, taskId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        // Защита: нельзя скачать скрытое вложение
        if (!this.canSeeAttachment(task, attachment, user)) {
            throw new ForbiddenException('Нет доступа к этому вложению');
        }

        return attachment;
    }

    /**
     * Удалить вложение
     */
    async deleteAttachment(taskId: number, attachmentId: number, user: any): Promise<{ success: boolean }> {
        const task = await this.findOne(taskId, user);

        const attachment = await this.attachmentsRepo.findOne({
            where: { id: attachmentId, taskId },
        });

        if (!attachment) {
            throw new NotFoundException('Вложение не найдено');
        }

        // Проверяем права (создатель задачи, загрузчик файла или админ)
        if (
            !user.isAdmin &&
            task.creatorName !== user.fullName &&
            attachment.uploaderName !== user.fullName
        ) {
            throw new ForbiddenException('Нет прав для удаления этого вложения');
        }

        // Удаляем файл с диска
        const filePath = getFilePath(attachment.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await this.attachmentsRepo.remove(attachment);

        return { success: true };
    }

    // ==================== ГРУППЫ ЗАДАЧ (персональные) ====================

    async getGroups(user: any) {
        const groups = await this.taskGroupRepo.find({
            where: { schoolId: user.schoolId, ownerName: user.fullName },
            relations: ['items'],
            order: { sortOrder: 'ASC', id: 'ASC' },
        });
        return groups.map((g) => ({
            id: g.id,
            name: g.name,
            sortOrder: g.sortOrder,
            taskIds: (g.items || []).map((i) => i.taskId),
        }));
    }

    async createGroup(user: any, name: string) {
        const clean = (name || '').trim();
        if (!clean) throw new BadRequestException('Название группы обязательно');
        const count = await this.taskGroupRepo.count({ where: { schoolId: user.schoolId, ownerName: user.fullName } });
        const group = await this.taskGroupRepo.save(
            this.taskGroupRepo.create({ schoolId: user.schoolId, ownerName: user.fullName, name: clean, sortOrder: count }),
        );
        return { id: group.id, name: group.name, sortOrder: group.sortOrder, taskIds: [] };
    }

    async renameGroup(user: any, id: number, name: string) {
        const group = await this.taskGroupRepo.findOne({ where: { id, schoolId: user.schoolId, ownerName: user.fullName } });
        if (!group) throw new NotFoundException('Группа не найдена');
        const clean = (name || '').trim();
        if (!clean) throw new BadRequestException('Название группы обязательно');
        group.name = clean;
        await this.taskGroupRepo.save(group);
        return { id: group.id, name: group.name };
    }

    async deleteGroup(user: any, id: number) {
        const group = await this.taskGroupRepo.findOne({ where: { id, schoolId: user.schoolId, ownerName: user.fullName } });
        if (!group) throw new NotFoundException('Группа не найдена');
        await this.taskGroupRepo.remove(group); // каскадно удаляет членства
        return { success: true };
    }

    async addTaskToGroup(user: any, groupId: number, taskId: number) {
        const group = await this.taskGroupRepo.findOne({ where: { id: groupId, schoolId: user.schoolId, ownerName: user.fullName } });
        if (!group) throw new NotFoundException('Группа не найдена');
        // одна группа на задачу у пользователя: убираем из прочих групп
        await this.removeTaskFromGroup(user, taskId);
        await this.taskGroupItemRepo.save(this.taskGroupItemRepo.create({ groupId, taskId }));
        return { success: true };
    }

    async removeTaskFromGroup(user: any, taskId: number) {
        const groups = await this.taskGroupRepo.find({ where: { schoolId: user.schoolId, ownerName: user.fullName } });
        const ids = groups.map((g) => g.id);
        if (ids.length) {
            await this.taskGroupItemRepo.delete({ groupId: In(ids), taskId });
        }
        return { success: true };
    }

    // ==================== СТАТУСЫ ВЫПОЛНЕНИЯ ДЛЯ СПИСКА ====================

    /**
     * Добавляет к задачам статусы выполнения:
     *  - isCompletedByUser — отметил ли текущий пользователь;
     *  - isFullyCompleted — отметили ли ВСЕ ожидаемые исполнители;
     *  - completionCount / expectedCount — для отображения доли.
     *
     * Считается пакетно (несколько запросов на весь список), чтобы не было N+1.
     */
    private async attachCompletionFlags(tasks: Task[], user: any): Promise<Task[]> {
        if (!tasks.length) return tasks;

        const ids = tasks.map((t) => t.id);

        // Кто и что отметил
        const completions = await this.completionsRepo.find({ where: { taskId: In(ids) } });
        const completedByTask = new Map<number, Set<number>>();
        for (const c of completions) {
            if (!completedByTask.has(c.taskId)) completedByTask.set(c.taskId, new Set());
            completedByTask.get(c.taskId)!.add(c.userProfileId);
        }

        // Профили школы: ФИО → id (для персональных назначений) и профиль текущего пользователя
        const profiles = await this.userProfileRepo.find({ where: { schoolId: user.schoolId } });
        const nameToProfileId = new Map(profiles.map((p) => [p.fullName, p.id]));
        const myProfileId = nameToProfileId.get(user.fullName);

        // Категория → участники
        const rows = await this.userCategoryRepo
            .createQueryBuilder('uc')
            .innerJoin('uc.category', 'cat')
            .where('cat.schoolId = :schoolId', { schoolId: user.schoolId })
            .select('cat.categoryName', 'categoryName')
            .addSelect('uc.userProfileId', 'userProfileId')
            .getRawMany();
        const categoryMembers = new Map<string, Set<number>>();
        for (const r of rows) {
            if (!categoryMembers.has(r.categoryName)) categoryMembers.set(r.categoryName, new Set());
            categoryMembers.get(r.categoryName)!.add(Number(r.userProfileId));
        }

        return tasks.map((task) => {
            const done = completedByTask.get(task.id) || new Set<number>();

            // Ожидаемые исполнители
            const expected = new Set<number>();
            if ((task as any).isPersonal) {
                const creatorId = nameToProfileId.get(task.creatorName);
                if (creatorId) expected.add(creatorId);
            } else {
                for (const a of task.assignees || []) {
                    if ((a as any).assigneeCategory) {
                        const members = categoryMembers.get((a as any).assigneeCategory);
                        if (members) members.forEach((id) => expected.add(id));
                    } else if ((a as any).assigneeUser) {
                        const pid = nameToProfileId.get((a as any).assigneeUser as string);
                        if (pid) expected.add(pid);
                    }
                }
            }

            const expectedCount = expected.size;
            const completedExpected = [...expected].filter((id) => done.has(id)).length;

            return {
                ...task,
                isCompletedByUser: myProfileId ? done.has(myProfileId) : false,
                isFullyCompleted: expectedCount > 0 && completedExpected === expectedCount,
                completionCount: done.size,
                expectedCount,
            } as Task;
        });
    }

    // ==================== РЕЖИМ «СЕГОДНЯ» (ФОКУС) ====================

    /**
     * Раз в сутки чистим планы за прошедшие дни (старше 30 дней),
     * чтобы таблица не росла бесконечно.
     */
    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async cleanupOldFocus() {
        const limit = new Date();
        limit.setDate(limit.getDate() - 30);
        await this.taskFocusRepo
            .createQueryBuilder()
            .delete()
            .where('focus_date < :limit', { limit: this.toLocalDateKey(limit) })
            .execute();
    }

    /** Локальная дата в формате YYYY-MM-DD */
    private toLocalDateKey(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /** Задача адресована пользователю: его категория, лично он, или это его личная задача */
    private isMyTask(task: Task, user: any, userCategories: string[]): boolean {
        if ((task as any).isPersonal) return task.creatorName === user.fullName;
        const cats = task.assignees?.filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory) || [];
        const users = task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser as string) || [];
        if (users.includes(user.fullName)) return true;
        return cats.some((c) => userCategories.includes(c));
    }

    /**
     * Задача «горит»: срок ещё не прошёл, но истекает сегодня.
     * Просроченные (срок уже истёк) сюда НЕ входят — их пользователь добавляет в план сам.
     */
    private isBurning(task: Task): boolean {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const deadline = new Date(task.deadline).getTime();
        return deadline >= Date.now() && deadline <= endOfToday.getTime();
    }

    /**
     * Задача попадает в план автоматически, если она адресована пользователю
     * и её срок истекает сегодня. Такие задачи убрать из плана нельзя.
     * Просроченные задачи автоматически не добавляются и убираются свободно.
     */
    private isAutoFocus(task: Task, user: any, userCategories: string[]): boolean {
        return this.isBurning(task) && this.isMyTask(task, user, userCategories);
    }

    /**
     * План на сегодня: автоматические (срочные) задачи + добавленные пользователем вручную.
     * Выполненные задачи остаются в списке — по ним считается прогресс дня.
     */
    async getTodayFocus(user: any): Promise<{
        date: string;
        total: number;
        completed: number;
        allDone: boolean;
        tasks: any[];
    }> {
        const dateKey = this.toLocalDateKey(new Date());

        // Все видимые пользователю задачи
        const visible = await this.findAll(user, {} as TaskFilterDto);
        const userCategories = await this.getUserCategories(user.schoolId, user.fullName);

        // Ручные записи плана на сегодня
        const manual = await this.taskFocusRepo.find({
            where: { schoolId: user.schoolId, ownerName: user.fullName, focusDate: dateKey },
        });
        const manualIds = new Set(manual.map((m) => m.taskId));

        const selected = visible.filter(
            (t) => this.isAutoFocus(t, user, userCategories) || manualIds.has(t.id),
        );

        // Статусы выполнения одним запросом
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });
        let completedIds = new Set<number>();
        if (profile && selected.length) {
            const completions = await this.completionsRepo.find({
                where: { userProfileId: profile.id, taskId: In(selected.map((t) => t.id)) },
            });
            completedIds = new Set(completions.map((c) => c.taskId));
        }

        const tasks = selected
            .map((t) => ({
                ...t,
                isAuto: this.isAutoFocus(t, user, userCategories),
                isCompletedByUser: completedIds.has(t.id),
            }))
            .sort((a, b) => {
                // Невыполненные выше, затем срочные, затем по дедлайну
                if (a.isCompletedByUser !== b.isCompletedByUser) return a.isCompletedByUser ? 1 : -1;
                if (a.isAuto !== b.isAuto) return a.isAuto ? -1 : 1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });

        const completed = tasks.filter((t) => t.isCompletedByUser).length;

        return {
            date: dateKey,
            total: tasks.length,
            completed,
            allDone: tasks.length > 0 && completed === tasks.length,
            tasks,
        };
    }

    /** Добавить существующую задачу в план на сегодня (дедлайн может быть любым) */
    async addToTodayFocus(user: any, taskId: number) {
        // Проверяем доступность задачи пользователю (бросит 404, если не видна)
        const task = await this.findOne(taskId, user);
        const dateKey = this.toLocalDateKey(new Date());
        const userCategories = await this.getUserCategories(user.schoolId, user.fullName);

        if (this.isAutoFocus(task, user, userCategories)) {
            return {
                success: true,
                alreadyAuto: true,
                message: 'Эта задача уже в плане на сегодня — она срочная и добавляется автоматически.',
            };
        }

        const existing = await this.taskFocusRepo.findOne({
            where: { schoolId: user.schoolId, ownerName: user.fullName, taskId, focusDate: dateKey },
        });
        if (!existing) {
            await this.taskFocusRepo.save(
                this.taskFocusRepo.create({
                    schoolId: user.schoolId,
                    ownerName: user.fullName,
                    taskId,
                    focusDate: dateKey,
                }),
            );
        }

        return { success: true, alreadyAuto: false };
    }

    /**
     * Убрать задачу из плана на сегодня.
     * Срочную задачу убрать нельзя — возвращаем понятное пояснение, а не ошибку.
     */
    async removeFromTodayFocus(user: any, taskId: number) {
        const task = await this.findOne(taskId, user);
        const dateKey = this.toLocalDateKey(new Date());
        const userCategories = await this.getUserCategories(user.schoolId, user.fullName);

        if (this.isAutoFocus(task, user, userCategories)) {
            return {
                success: false,
                reason: 'auto',
                message:
                    'Эту задачу нельзя убрать: её срок истекает сегодня, поэтому она остаётся в плане на сегодня.',
            };
        }

        await this.taskFocusRepo.delete({
            schoolId: user.schoolId,
            ownerName: user.fullName,
            taskId,
            focusDate: dateKey,
        });

        return { success: true };
    }

    /** Задачи, которые можно добавить в план: видимые, ещё не в плане и не выполненные */
    async getTodayFocusCandidates(user: any): Promise<any[]> {
        const dateKey = this.toLocalDateKey(new Date());
        const visible = await this.findAll(user, {} as TaskFilterDto);
        const userCategories = await this.getUserCategories(user.schoolId, user.fullName);

        const manual = await this.taskFocusRepo.find({
            where: { schoolId: user.schoolId, ownerName: user.fullName, focusDate: dateKey },
        });
        const manualIds = new Set(manual.map((m) => m.taskId));

        const candidates = visible.filter(
            (t) => !this.isAutoFocus(t, user, userCategories) && !manualIds.has(t.id),
        );

        const profile = await this.userProfileRepo.findOne({
            where: { schoolId: user.schoolId, fullName: user.fullName },
        });
        if (profile && candidates.length) {
            const completions = await this.completionsRepo.find({
                where: { userProfileId: profile.id, taskId: In(candidates.map((t) => t.id)) },
            });
            const done = new Set(completions.map((c) => c.taskId));
            return candidates.filter((t) => !done.has(t.id));
        }

        return candidates;
    }

    // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================

    private enrichTask(task: Task, user: any): Task {
        const now = new Date();
        const deadline = new Date(task.deadline);
        const diff = deadline.getTime() - now.getTime();
        const hours = diff / (1000 * 60 * 60);

        // Определяем приоритет
        let priority: 'urgent' | 'medium' | 'low' | 'overdue';
        if (hours < 0) {
            priority = 'overdue';
            task.isOverdue = true;
        } else if (hours <= 24) {
            priority = 'urgent';
        } else if (hours <= 72) {
            priority = 'medium';
        } else {
            priority = 'low';
        }

        // Добавляем дополнительные поля
        const viewedByUser = task.views?.some((v) => v.viewerName === user.fullName) ?? false;
        const assigneeCategories = task.assignees?.filter((a: any) => a.assigneeCategory).map((a) => a.assigneeCategory) ?? [];
        const assigneeUsers = task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser as string) ?? [];

        // Учитываем видимость вложений для текущего пользователя
        const visibleAttachments = task.attachments?.filter((a) =>
            this.canSeeAttachment(task, a, user),
        );

        return {
            ...task,
            attachments: visibleAttachments ?? task.attachments,
            priority,
            viewedByUser,
            viewsCount: task.views?.length ?? 0,
            attachmentsCount: visibleAttachments?.length ?? 0,
            assigneeCategories,
            assigneeUsers,
            isPersonal: (task as any).isPersonal || false,
            categoryOnly: (task as any).categoryOnly || false,
            restrictAttachments: (task as any).restrictAttachments || false,
            isImportant: (task as any).isImportant || false,
            recurrence: (task as any).recurrence || null,
        } as Task;
    }
}
