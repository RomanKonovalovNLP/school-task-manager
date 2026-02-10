import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { ScheduleVersionsService } from './schedule-versions.service';
import * as ExcelJS from 'exceljs';

interface ExportOptions {
    format: 'xlsx' | 'pdf' | 'html';
    view: 'class' | 'teacher' | 'room';
    ids?: number[];
    weekType?: 'odd' | 'even';
}

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

@Injectable()
export class ScheduleExportService {
    constructor(
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        private versionsService: ScheduleVersionsService,
    ) {}

    async export(versionId: number, schoolId: number, options: ExportOptions): Promise<Buffer> {
        await this.versionsService.checkAccess(versionId, schoolId);

        switch (options.format) {
            case 'xlsx':
                return this.exportToExcel(versionId, options);
            case 'html':
                return this.exportToHtml(versionId, options);
            default:
                return this.exportToExcel(versionId, options);
        }
    }

    private async exportToExcel(versionId: number, options: ExportOptions): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SchoolTakt';
        workbook.created = new Date();

        // Получаем данные
        let lessons: ScheduleLesson[];

        if (options.view === 'class') {
            lessons = await this.versionsService.getScheduleByClass(versionId, 0) as ScheduleLesson[];
        } else if (options.view === 'teacher') {
            lessons = await this.versionsService.getScheduleByTeacher(versionId, 0) as ScheduleLesson[];
        } else {
            lessons = await this.versionsService.getScheduleByRoom(versionId, 0) as ScheduleLesson[];
        }

        // Группируем по сущности
        const groups = this.groupLessons(lessons, options.view);

        for (const [entityName, entityLessons] of Object.entries(groups)) {
            const worksheet = workbook.addWorksheet(entityName.substring(0, 31)); // Excel ограничение

            // Заголовок
            worksheet.mergeCells('A1:G1');
            worksheet.getCell('A1').value = `Расписание: ${entityName}`;
            worksheet.getCell('A1').font = { bold: true, size: 14 };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            // Заголовки дней
            worksheet.getRow(3).values = ['Урок', ...DAYS.slice(1, 7)];
            worksheet.getRow(3).font = { bold: true };
            worksheet.getRow(3).alignment = { horizontal: 'center' };

            // Данные
            for (let lessonNum = 1; lessonNum <= 7; lessonNum++) {
                const row = worksheet.getRow(lessonNum + 3);
                row.getCell(1).value = lessonNum;

                for (let day = 1; day <= 6; day++) {
                    const lesson = (entityLessons as ScheduleLesson[]).find(
                        l => l.dayOfWeek === day && l.lessonNumber === lessonNum
                    );

                    if (lesson) {
                        const subject = lesson.workload?.subject;
                        const teacher = lesson.workload?.teacher;
                        const room = lesson.room;

                        let cellValue = subject?.shortName || subject?.name || '';
                        if (options.view === 'class' && teacher) {
                            cellValue += `\n${teacher.shortName}`;
                        }
                        if (room) {
                            cellValue += `\nкаб. ${room.name}`;
                        }

                        const cell = row.getCell(day + 1);
                        cell.value = cellValue;
                        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
                        
                        // Цвет фона
                        if (subject?.color) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: subject.color.replace('#', 'FF') },
                            };
                        }
                    }
                }
            }

            // Настройка ширины колонок
            worksheet.getColumn(1).width = 8;
            for (let i = 2; i <= 7; i++) {
                worksheet.getColumn(i).width = 20;
            }

            // Высота строк
            for (let i = 4; i <= 10; i++) {
                worksheet.getRow(i).height = 50;
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    private async exportToHtml(versionId: number, options: ExportOptions): Promise<Buffer> {
        let lessons: ScheduleLesson[];

        if (options.view === 'class') {
            lessons = await this.versionsService.getScheduleByClass(versionId, 0) as ScheduleLesson[];
        } else if (options.view === 'teacher') {
            lessons = await this.versionsService.getScheduleByTeacher(versionId, 0) as ScheduleLesson[];
        } else {
            lessons = await this.versionsService.getScheduleByRoom(versionId, 0) as ScheduleLesson[];
        }

        const groups = this.groupLessons(lessons, options.view);

        let html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Расписание</title>
    <style>
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        th { background: #f5f5f5; }
        h2 { margin-top: 30px; }
        .lesson { padding: 5px; border-radius: 4px; }
        .subject { font-weight: bold; }
        .teacher { font-size: 0.9em; color: #666; }
        .room { font-size: 0.85em; color: #999; }
        @media print { .page-break { page-break-before: always; } }
    </style>
</head>
<body>
`;

        for (const [entityName, entityLessons] of Object.entries(groups)) {
            html += `<div class="page-break"><h2>${entityName}</h2>`;
            html += `<table><tr><th>Урок</th>`;
            for (let day = 1; day <= 6; day++) {
                html += `<th>${DAYS[day]}</th>`;
            }
            html += `</tr>`;

            for (let lessonNum = 1; lessonNum <= 7; lessonNum++) {
                html += `<tr><td>${lessonNum}</td>`;
                for (let day = 1; day <= 6; day++) {
                    const lesson = (entityLessons as ScheduleLesson[]).find(
                        l => l.dayOfWeek === day && l.lessonNumber === lessonNum
                    );

                    if (lesson) {
                        const subject = lesson.workload?.subject;
                        const teacher = lesson.workload?.teacher;
                        const room = lesson.room;
                        const bgColor = subject?.color || '#fff';

                        html += `<td><div class="lesson" style="background: ${bgColor}">`;
                        html += `<div class="subject">${subject?.shortName || subject?.name || ''}</div>`;
                        if (teacher) html += `<div class="teacher">${teacher.shortName}</div>`;
                        if (room) html += `<div class="room">каб. ${room.name}</div>`;
                        html += `</div></td>`;
                    } else {
                        html += `<td></td>`;
                    }
                }
                html += `</tr>`;
            }
            html += `</table></div>`;
        }

        html += `</body></html>`;

        return Buffer.from(html, 'utf-8');
    }

    private groupLessons(lessons: ScheduleLesson[], view: string): Record<string, ScheduleLesson[]> {
        const groups: Record<string, ScheduleLesson[]> = {};

        for (const lesson of lessons) {
            let key: string;

            if (view === 'class') {
                key = lesson.workload?.schoolClass?.name || 'Без класса';
            } else if (view === 'teacher') {
                key = lesson.workload?.teacher?.fullName || 'Без учителя';
            } else {
                key = lesson.room?.name || 'Без кабинета';
            }

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(lesson);
        }

        return groups;
    }
}
