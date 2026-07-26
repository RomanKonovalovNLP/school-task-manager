import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExportService {
    constructor(
        @InjectRepository(Task)
        private tasksRepo: Repository<Task>,
    ) {}

    /**
     * Экспорт задач в Excel
     */
    async exportToExcel(schoolId: number): Promise<Buffer> {
        const tasks = await this.tasksRepo.find({
            // Личные задачи не выгружаем: это приватные заметки пользователей
            where: { schoolId, isPersonal: false } as any,
            relations: ['assignees', 'views'],
            order: { deadline: 'ASC' },
        });

        // Создаем книгу Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Задачи');

        // Настройка столбцов
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Название', key: 'title', width: 30 },
            { header: 'Описание', key: 'description', width: 40 },
            { header: 'Создатель', key: 'creator', width: 20 },
            { header: 'Категории', key: 'categories', width: 30 },
            { header: 'Дедлайн', key: 'deadline', width: 20 },
            { header: 'Статус', key: 'status', width: 15 },
            { header: 'Приоритет', key: 'priority', width: 15 },
            { header: 'Просмотры', key: 'views', width: 12 },
            { header: 'Создана', key: 'createdAt', width: 20 },
        ];

        // Стилизация заголовка
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Заполнение данными
        tasks.forEach((task) => {
            // ИСПРАВЛЕНО: у персональных назначений assigneeCategory = NULL —
            // без фильтрации в выгрузку попадали пустые значения. Персональных
            // адресатов показываем отдельно, по ФИО.
            const categories = this.formatAssignees(task, ', ');
            const priority = this.getPriority(task);
            const status = task.isOverdue ? 'Просрочено' : 'Активно';

            worksheet.addRow({
                id: task.id,
                title: task.title,
                description: task.description || '-',
                creator: task.creatorName,
                categories,
                deadline: this.formatDate(task.deadline),
                status,
                priority,
                views: task.views?.length || 0,
                createdAt: this.formatDate(task.createdAt),
            });
        });

        // Добавляем автофильтр
        worksheet.autoFilter = {
            from: 'A1',
            to: 'J1',
        };

        // Генерируем буфер
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Экспорт статистики в Excel
     */
    async exportStatisticsToExcel(
        schoolId: number,
        statistics: any,
    ): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();

        // Лист 1: Общая статистика
        const summarySheet = workbook.addWorksheet('Общая статистика');
        summarySheet.columns = [
            { header: 'Показатель', key: 'metric', width: 30 },
            { header: 'Значение', key: 'value', width: 20 },
        ];

        summarySheet.getRow(1).font = { bold: true };
        summarySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };

        summarySheet.addRows([
            { metric: 'Всего задач', value: statistics.totalTasks },
            { metric: 'Выполнено', value: statistics.completedTasks },
            { metric: 'Просрочено', value: statistics.overdueTasks },
            { metric: 'Срочные', value: statistics.urgentTasks },
            { metric: 'Средний приоритет', value: statistics.mediumPriorityTasks },
            { metric: 'Низкий приоритет', value: statistics.lowPriorityTasks },
            {
                metric: 'Процент выполнения',
                value: `${statistics.completionRate.toFixed(1)}%`,
            },
        ]);

        // Лист 2: По категориям
        const categoriesSheet = workbook.addWorksheet('По категориям');
        categoriesSheet.columns = [
            { header: 'Категория', key: 'category', width: 30 },
            { header: 'Количество', key: 'count', width: 15 },
        ];

        categoriesSheet.getRow(1).font = { bold: true };
        categoriesSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };

        Object.entries(statistics.tasksByCategory).forEach(([category, count]) => {
            categoriesSheet.addRow({ category, count });
        });

        // Генерируем буфер
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Экспорт в CSV
     */
    async exportToCSV(schoolId: number): Promise<string> {
        const tasks = await this.tasksRepo.find({
            // Личные задачи не выгружаем: это приватные заметки пользователей
            where: { schoolId, isPersonal: false } as any,
            relations: ['assignees', 'views'],
            order: { deadline: 'ASC' },
        });

        // Заголовки CSV
        const headers = [
            'ID',
            'Название',
            'Описание',
            'Создатель',
            'Категории',
            'Дедлайн',
            'Статус',
            'Приоритет',
            'Просмотры',
            'Создана',
        ];

        // Строки данных
        const rows = tasks.map((task) => {
            const categories = this.formatAssignees(task, '; ');
            const priority = this.getPriority(task);
            const status = task.isOverdue ? 'Просрочено' : 'Активно';

            return [
                task.id,
                `"${task.title}"`,
                `"${task.description || '-'}"`,
                task.creatorName,
                `"${categories}"`,
                this.formatDate(task.deadline),
                status,
                priority,
                task.views?.length || 0,
                this.formatDate(task.createdAt),
            ];
        });

        // Собираем CSV
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        return csv;
    }

    /**
     * Экспорт в JSON
     */
    async exportToJSON(schoolId: number): Promise<any> {
        const tasks = await this.tasksRepo.find({
            // Личные задачи не выгружаем: это приватные заметки пользователей
            where: { schoolId, isPersonal: false } as any,
            relations: ['assignees', 'views'],
            order: { deadline: 'ASC' },
        });

        return tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            creator: task.creatorName,
            categories:
                task.assignees?.filter((a: any) => a.assigneeCategory).map((a: any) => a.assigneeCategory) || [],
            assigneeUsers:
                task.assignees?.filter((a: any) => a.assigneeUser).map((a: any) => a.assigneeUser) || [],
            deadline: task.deadline,
            status: task.isOverdue ? 'overdue' : 'active',
            priority: this.getPriority(task),
            viewsCount: task.views?.length || 0,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        }));
    }

    /**
     * Вспомогательные методы
     */
    /**
     * «Для кого» одной строкой: категории и персональные адресаты.
     * Строки персональных назначений имеют assigneeCategory = NULL,
     * поэтому их нужно обрабатывать отдельно, иначе в выгрузке появлялись пустые значения.
     */
    private formatAssignees(task: Task, separator: string): string {
        const categories = (task.assignees || [])
            .filter((a: any) => a.assigneeCategory)
            .map((a: any) => a.assigneeCategory as string);
        const users = (task.assignees || [])
            .filter((a: any) => a.assigneeUser)
            .map((a: any) => `${a.assigneeUser} (лично)`);

        const all = [...categories, ...users];
        return all.length ? all.join(separator) : '-';
    }

    private getPriority(task: Task): string {
        if (task.isOverdue) return 'Просрочено';

        const now = new Date();
        const hoursLeft = (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursLeft <= 24) return 'Срочно';
        if (hoursLeft <= 72) return 'Средне';
        return 'Низко';
    }

    private formatDate(date: Date): string {
        return new Date(date).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
}
