import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Substitution } from '../entities/substitution.entity';
import { ScheduleVersionsService } from './schedule-versions.service';
import * as ExcelJS from 'exceljs';

interface ExportOptions {
    format: 'xlsx' | 'pdf' | 'html';
    // master — единый лист «по классам» для печати/сайта
    view: 'class' | 'teacher' | 'room' | 'master';
    ids?: number[];
    weekType?: 'odd' | 'even';
    paper?: 'a4' | 'a5';
    date?: string; // если задана — применяем замены на эту дату
}

const DAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function esc(v: any): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

@Injectable()
export class ScheduleExportService {
    constructor(
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Substitution)
        private subRepo: Repository<Substitution>,
        private versionsService: ScheduleVersionsService,
    ) {}

    async export(versionId: number, schoolId: number, options: ExportOptions): Promise<Buffer> {
        await this.versionsService.checkAccess(versionId, schoolId);

        switch (options.format) {
            case 'html':
                return options.view === 'master'
                    ? this.exportMasterHtml(versionId, options)
                    : this.exportToHtml(versionId, options);
            case 'xlsx':
            default:
                return options.view === 'master'
                    ? this.exportMasterExcel(versionId, options)
                    : this.exportToExcel(versionId, options);
        }
    }

    private async loadLessons(versionId: number, date?: string): Promise<ScheduleLesson[]> {
        const lessons = await this.lessonRepo.find({
            where: { versionId },
            relations: ['workload', 'workload.schoolClass', 'workload.teacher', 'workload.subject', 'room'],
        });
        if (!date) return lessons;
        return this.applySubstitutions(lessons, date);
    }

    /** Применяет замены на дату: подменяет предмет/учителя/кабинет/позицию, «окно» убирает урок. */
    private async applySubstitutions(lessons: ScheduleLesson[], date: string): Promise<ScheduleLesson[]> {
        const ids = lessons.map((l) => l.id);
        if (ids.length === 0) return lessons;
        const subs = await this.subRepo.find({
            where: { lessonId: In(ids), date: date as any },
            relations: ['newTeacher', 'newRoom', 'newSubject'],
        });
        if (subs.length === 0) return lessons;
        const byLesson = new Map(subs.map((sb) => [sb.lessonId, sb]));
        const out: ScheduleLesson[] = [];
        for (const l of lessons) {
            const sub = byLesson.get(l.id);
            if (!sub) { out.push(l); continue; }
            if (sub.isCancelled) continue; // окно — урок не показываем
            const clone: any = { ...l };
            if (sub.newDayOfWeek != null) clone.dayOfWeek = sub.newDayOfWeek;
            if (sub.newLessonNumber != null) clone.lessonNumber = sub.newLessonNumber;
            if (sub.newWeekType) clone.weekType = sub.newWeekType;
            if (sub.newRoom) { clone.room = sub.newRoom; clone.roomId = sub.newRoomId; }
            const w: any = { ...(l.workload || {}) };
            if (sub.newSubject) w.subject = sub.newSubject;
            if (sub.newTeacher) w.teacher = sub.newTeacher;
            clone.workload = w;
            out.push(clone);
        }
        return out;
    }

    /** Габариты сетки по данным (сколько уроков и дней реально есть). */
    private gridSize(lessons: ScheduleLesson[]): { maxLesson: number; maxDay: number } {
        let maxLesson = 7;
        let maxDay = 5;
        for (const l of lessons) {
            if (l.lessonNumber > maxLesson) maxLesson = l.lessonNumber;
            if (l.dayOfWeek > maxDay) maxDay = l.dayOfWeek;
        }
        return { maxLesson: Math.min(maxLesson, 10), maxDay: Math.min(maxDay, 6) };
    }

    /** Отсортированный список классов из уроков (сначала 1 смена, затем 2). */
    private classesFromLessons(lessons: ScheduleLesson[]) {
        const map = new Map<number, { id: number; name: string; grade: number; shift: number }>();
        for (const l of lessons) {
            const c = l.workload?.schoolClass;
            if (c && !map.has(c.id)) {
                map.set(c.id, { id: c.id, name: c.name, grade: (c as any).gradeLevel || 0, shift: ((c as any).shift) || 1 });
            }
        }
        return [...map.values()].sort((a, b) => a.shift - b.shift || a.grade - b.grade || a.name.localeCompare(b.name));
    }

    /** Смены в порядке следования (1, затем 2). */
    private shiftsOf(classes: { shift: number }[]): number[] {
        const s: number[] = [];
        for (const c of classes) if (!s.includes(c.shift)) s.push(c.shift);
        return s.sort((a, b) => a - b);
    }

    // ==================== Единый лист «по классам» (мастер) ====================

    private async exportMasterHtml(versionId: number, options: ExportOptions): Promise<Buffer> {
        const lessons = await this.loadLessons(versionId, options.date);
        const allClasses = this.classesFromLessons(lessons);
        const { maxLesson, maxDay } = this.gridSize(lessons);
        const paper = options.paper === 'a5' ? 'A5' : 'A4';

        // Индекс: `${classId}-${day}-${lesson}` -> lesson (первый подходящий)
        const idx = new Map<string, ScheduleLesson>();
        for (const l of lessons) {
            const cid = l.workload?.schoolClass?.id;
            if (!cid) continue;
            if (options.weekType && l.weekType !== 'both' && l.weekType !== options.weekType) continue;
            const k = `${cid}-${l.dayOfWeek}-${l.lessonNumber}`;
            if (!idx.has(k)) idx.set(k, l);
        }

        const buildTable = (classes: { id: number; name: string }[]) => {
            let rows = '';
            for (let day = 1; day <= maxDay; day++) {
                for (let ln = 1; ln <= maxLesson; ln++) {
                    rows += '<tr>';
                    if (ln === 1) rows += `<td class="dayband" rowspan="${maxLesson}">${DAYS_SHORT[day]}</td>`;
                    rows += `<td class="ln">${ln}</td>`;
                    for (const c of classes) {
                        const l = idx.get(`${c.id}-${day}-${ln}`);
                        if (l) {
                            const subj = l.workload?.subject;
                            const room = l.room;
                            const bg = subj?.color || '#fff';
                            rows += `<td class="cell" style="background:${esc(bg)}"><div class="subj">${esc(subj?.shortName || subj?.name || '')}</div>${room ? `<div class="room">${esc(room.name)}</div>` : ''}</td>`;
                        } else {
                            rows += '<td class="cell"></td>';
                        }
                    }
                    rows += '</tr>';
                }
            }
            return `<table><thead><tr><th colspan="2">День / урок</th>${classes.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
        };

        // Каждая смена — на отдельной странице (page-break)
        const shifts = this.shiftsOf(allClasses);
        const multi = shifts.length > 1;
        let sections = '';
        shifts.forEach((sh, i) => {
            const cls = allClasses.filter((c) => c.shift === sh);
            const title = multi ? `<h2>${sh} смена</h2>` : '';
            sections += `<div class="${i > 0 ? 'page-break' : ''}">${title}${buildTable(cls)}</div>`;
        });
        if (!sections) sections = buildTable(allClasses);

        const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Расписание по классам</title>
<style>
  @page { size: ${paper} landscape; margin: 6mm; }
  body { font-family: Arial, sans-serif; margin: 0; color: #111; }
  h1 { font-size: 14px; margin: 4px 0 6px; text-align: center; }
  h2 { font-size: 13px; margin: 8px 0 4px; text-align: center; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #888; padding: 1px 2px; text-align: center; overflow: hidden; }
  th { background: #eaeaea; font-size: 10px; padding: 3px 2px; }
  td.ln { width: 16px; font-weight: bold; background: #f6f6f6; }
  td.dayband { width: 18px; writing-mode: vertical-rl; transform: rotate(180deg); font-weight: bold; background: #f0f0f0; }
  td.cell { height: 26px; }
  .subj { font-weight: bold; font-size: 9px; line-height: 1.05; }
  .room { font-size: 7px; color: #555; }
  .hint { text-align: center; font-size: 8px; color: #888; margin-top: 4px; }
  .page-break { page-break-before: always; }
  @media print { .noprint { display: none; } }
</style></head>
<body onload="window.focus()">
  <button class="noprint" onclick="window.print()" style="margin:6px;padding:6px 10px;">🖨 Печать (${paper})</button>
  <h1>Расписание уроков по классам</h1>
  ${sections}
  <div class="hint">Найдите столбец своего класса. Печать: Ctrl/⌘+P → бумага ${paper}, ориентация «Альбомная».${multi ? ' Каждая смена — на отдельной странице.' : ''}</div>
</body></html>`;

        return Buffer.from(html, 'utf-8');
    }

    private async exportMasterExcel(versionId: number, options: ExportOptions): Promise<Buffer> {
        const lessons = await this.loadLessons(versionId, options.date);
        const allClasses = this.classesFromLessons(lessons);
        const { maxLesson, maxDay } = this.gridSize(lessons);

        const idx = new Map<string, ScheduleLesson>();
        for (const l of lessons) {
            const cid = l.workload?.schoolClass?.id;
            if (!cid) continue;
            const k = `${cid}-${l.dayOfWeek}-${l.lessonNumber}`;
            if (!idx.has(k)) idx.set(k, l);
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ПланТакт';

        const fillSheet = (ws: ExcelJS.Worksheet, classes: { id: number; name: string }[]) => {
            ws.getRow(1).values = ['День', 'Урок', ...classes.map((c) => c.name)];
            ws.getRow(1).font = { bold: true };
            ws.getRow(1).alignment = { horizontal: 'center' };
            let r = 2;
            for (let day = 1; day <= maxDay; day++) {
                for (let ln = 1; ln <= maxLesson; ln++) {
                    const row = ws.getRow(r++);
                    row.getCell(1).value = ln === 1 ? DAYS[day] : '';
                    row.getCell(2).value = ln;
                    classes.forEach((c, i) => {
                        const l = idx.get(`${c.id}-${day}-${ln}`);
                        if (l) {
                            const subj = l.workload?.subject;
                            const room = l.room;
                            const cell = row.getCell(3 + i);
                            cell.value = `${subj?.shortName || subj?.name || ''}${room ? ` (${room.name})` : ''}`;
                            cell.alignment = { horizontal: 'center', wrapText: true };
                            if (subj?.color) {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subj.color.replace('#', 'FF') } };
                            }
                        }
                    });
                }
            }
            ws.getColumn(1).width = 12;
            ws.getColumn(2).width = 6;
            classes.forEach((_, i) => (ws.getColumn(3 + i).width = 14));
        };

        // Каждая смена — на отдельном листе
        const shifts = this.shiftsOf(allClasses);
        const multi = shifts.length > 1;
        if (shifts.length === 0) {
            fillSheet(wb.addWorksheet('По классам'), allClasses);
        } else {
            for (const sh of shifts) {
                const cls = allClasses.filter((c) => c.shift === sh);
                fillSheet(wb.addWorksheet(multi ? `${sh} смена` : 'По классам'), cls);
            }
        }

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    // ==================== Excel по сущностям ====================

    private async exportToExcel(versionId: number, options: ExportOptions): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ПланТакт';
        workbook.created = new Date();

        const lessons = await this.loadLessons(versionId, options.date);
        const groups = this.groupLessons(lessons, options.view);

        for (const [entityName, entityLessons] of Object.entries(groups)) {
            const worksheet = workbook.addWorksheet(entityName.substring(0, 31));

            worksheet.mergeCells('A1:G1');
            worksheet.getCell('A1').value = `Расписание: ${entityName}`;
            worksheet.getCell('A1').font = { bold: true, size: 14 };
            worksheet.getCell('A1').alignment = { horizontal: 'center' };

            worksheet.getRow(3).values = ['Урок', ...DAYS.slice(1, 7)];
            worksheet.getRow(3).font = { bold: true };
            worksheet.getRow(3).alignment = { horizontal: 'center' };

            for (let lessonNum = 1; lessonNum <= 7; lessonNum++) {
                const row = worksheet.getRow(lessonNum + 3);
                row.getCell(1).value = lessonNum;

                for (let day = 1; day <= 6; day++) {
                    const lesson = (entityLessons as ScheduleLesson[]).find(
                        l => l.dayOfWeek === day && l.lessonNumber === lessonNum,
                    );

                    if (lesson) {
                        const subject = lesson.workload?.subject;
                        const teacher = lesson.workload?.teacher;
                        const room = lesson.room;

                        let cellValue = subject?.shortName || subject?.name || '';
                        if (options.view === 'class' && teacher) cellValue += `\n${teacher.shortName}`;
                        if (room) cellValue += `\nкаб. ${room.name}`;

                        const cell = row.getCell(day + 1);
                        cell.value = cellValue;
                        cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };

                        if (subject?.color) {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: subject.color.replace('#', 'FF') } };
                        }
                    }
                }
            }

            worksheet.getColumn(1).width = 8;
            for (let i = 2; i <= 7; i++) worksheet.getColumn(i).width = 20;
            for (let i = 4; i <= 10; i++) worksheet.getRow(i).height = 50;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    // ==================== HTML по сущностям (каждая на своём листе) ====================

    private async exportToHtml(versionId: number, options: ExportOptions): Promise<Buffer> {
        const lessons = await this.loadLessons(versionId, options.date);
        const groups = this.groupLessons(lessons, options.view);
        const paper = options.paper === 'a5' ? 'A5' : 'A4';

        let html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Расписание</title>
<style>
  @page { size: ${paper} portrait; margin: 10mm; }
  body { font-family: Arial, sans-serif; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; table-layout: fixed; }
  th, td { border: 1px solid #ccc; padding: 4px; text-align: center; }
  th { background: #f5f5f5; }
  h2 { margin: 10px 0 6px; font-size: 15px; }
  .lesson { padding: 3px; border-radius: 4px; }
  .subject { font-weight: bold; font-size: 12px; }
  .teacher { font-size: 0.85em; color: #666; }
  .room { font-size: 0.8em; color: #999; }
  @media print { .page-break { page-break-before: always; } .noprint { display: none; } }
</style></head>
<body onload="window.focus()">
<button class="noprint" onclick="window.print()" style="margin:6px;padding:6px 10px;">🖨 Печать (${paper})</button>
`;

        let first = true;
        for (const [entityName, entityLessons] of Object.entries(groups)) {
            html += `<div class="${first ? '' : 'page-break'}"><h2>${esc(entityName)}</h2>`;
            first = false;
            html += `<table><tr><th>Урок</th>`;
            for (let day = 1; day <= 6; day++) html += `<th>${DAYS[day]}</th>`;
            html += `</tr>`;

            for (let lessonNum = 1; lessonNum <= 7; lessonNum++) {
                html += `<tr><td>${lessonNum}</td>`;
                for (let day = 1; day <= 6; day++) {
                    const lesson = (entityLessons as ScheduleLesson[]).find(
                        l => l.dayOfWeek === day && l.lessonNumber === lessonNum,
                    );
                    if (lesson) {
                        const subject = lesson.workload?.subject;
                        const teacher = lesson.workload?.teacher;
                        const room = lesson.room;
                        const bgColor = subject?.color || '#fff';
                        html += `<td><div class="lesson" style="background: ${esc(bgColor)}">`;
                        html += `<div class="subject">${esc(subject?.shortName || subject?.name || '')}</div>`;
                        if (options.view !== 'teacher' && teacher) html += `<div class="teacher">${esc(teacher.shortName)}</div>`;
                        if (room) html += `<div class="room">каб. ${esc(room.name)}</div>`;
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
            if (view === 'class') key = lesson.workload?.schoolClass?.name || 'Без класса';
            else if (view === 'teacher') key = lesson.workload?.teacher?.fullName || 'Без учителя';
            else key = lesson.room?.name || 'Без кабинета';
            if (!groups[key]) groups[key] = [];
            groups[key].push(lesson);
        }
        return groups;
    }
}
