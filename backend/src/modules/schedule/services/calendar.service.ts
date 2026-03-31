import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CalendarDay, DayType } from '../entities/calendar-day.entity';
import { ScheduleVersion, ScheduleVersionType } from '../entities/schedule-version.entity';

@Injectable()
export class CalendarService {
    constructor(
        @InjectRepository(CalendarDay)
        private calendarRepo: Repository<CalendarDay>,
        @InjectRepository(ScheduleVersion)
        private versionRepo: Repository<ScheduleVersion>,
    ) {}

    /**
     * Получить все календарные дни версии
     */
    async getCalendarDays(versionId: number, schoolId: number): Promise<CalendarDay[]> {
        const version = await this.versionRepo.findOne({ where: { id: versionId, schoolId } });
        if (!version) throw new NotFoundException('Версия не найдена');

        return this.calendarRepo.find({
            where: { versionId },
            order: { date: 'ASC' },
        });
    }

    /**
     * Получить дни для конкретной недели
     */
    async getWeekDays(versionId: number, schoolId: number, weekStart: string): Promise<CalendarDay[]> {
        const version = await this.versionRepo.findOne({ where: { id: versionId, schoolId } });
        if (!version) throw new NotFoundException('Версия не найдена');

        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        return this.calendarRepo.find({
            where: { versionId, date: Between(start, end) },
            order: { date: 'ASC' },
        });
    }

    /**
     * Автоматическая генерация календарных дней для периода
     */
    async generateCalendar(versionId: number, schoolId: number, startDate: string, endDate: string): Promise<CalendarDay[]> {
        const version = await this.versionRepo.findOne({ where: { id: versionId, schoolId } });
        if (!version) throw new NotFoundException('Версия не найдена');

        // Удаляем старые дни
        await this.calendarRepo.delete({ versionId });

        const start = new Date(startDate);
        const end = new Date(endDate);
        const isOddEven = version.weekType === 'odd_even';
        const workingDays = version.workingDays || 31; // битовая маска

        const days: CalendarDay[] = [];
        let weekCounter = 1; // 1=нечётная, 2=чётная
        let lastMonday: Date | null = null;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const date = new Date(d);
            const jsDay = date.getDay(); // 0=Вс, 1=Пн ...
            const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Пн ... 7=Вс
            const dayBit = 1 << (isoDay - 1);

            // Определяем номер недели для двухнедельного
            if (isoDay === 1) { // Понедельник
                if (lastMonday) {
                    weekCounter = weekCounter === 1 ? 2 : 1;
                }
                lastMonday = new Date(date);
            }

            // Проверяем рабочий ли день по маске
            const isWorkingDay = !!(workingDays & dayBit);

            const calDay = this.calendarRepo.create({
                versionId,
                date,
                dayType: isWorkingDay ? DayType.WORKING : DayType.HOLIDAY,
                weekNumber: isOddEven ? weekCounter : null,
                maxLessons: null,
                note: null,
            });

            days.push(calDay);
        }

        // Обновляем даты в версии
        version.startDate = start;
        version.endDate = end;
        await this.versionRepo.save(version);

        return this.calendarRepo.save(days);
    }

    /**
     * Обновить один день (переключить тип)
     */
    async updateDay(
        versionId: number,
        schoolId: number,
        date: string,
        dayType: DayType,
        maxLessons?: number,
        note?: string,
    ): Promise<CalendarDay> {
        const version = await this.versionRepo.findOne({ where: { id: versionId, schoolId } });
        if (!version) throw new NotFoundException('Версия не найдена');

        let day = await this.calendarRepo.findOne({
            where: { versionId, date: new Date(date) },
        });

        if (!day) {
            day = this.calendarRepo.create({
                versionId,
                date: new Date(date),
                dayType,
                maxLessons: maxLessons || null,
                note: note || null,
            });
        } else {
            // Не позволяем менять прошедшие дни
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayDate = new Date(day.date);
            dayDate.setHours(0, 0, 0, 0);

            if (dayDate < today) {
                throw new NotFoundException('Нельзя изменять прошедшие дни');
            }

            day.dayType = dayType;
            if (maxLessons !== undefined) day.maxLessons = maxLessons || null;
            if (note !== undefined) day.note = note || null;
        }

        return this.calendarRepo.save(day);
    }

    /**
     * Массовое обновление дней
     */
    async bulkUpdateDays(
        versionId: number,
        schoolId: number,
        updates: Array<{ date: string; dayType: DayType; maxLessons?: number; note?: string }>,
    ): Promise<CalendarDay[]> {
        const results: CalendarDay[] = [];
        for (const upd of updates) {
            const day = await this.updateDay(versionId, schoolId, upd.date, upd.dayType, upd.maxLessons, upd.note);
            results.push(day);
        }
        return results;
    }

    /**
     * Получить статистику периода
     */
    async getCalendarStats(versionId: number, schoolId: number) {
        const days = await this.getCalendarDays(versionId, schoolId);
        const working = days.filter(d => d.dayType === DayType.WORKING).length;
        const holidays = days.filter(d => d.dayType === DayType.HOLIDAY).length;
        const shortened = days.filter(d => d.dayType === DayType.SHORTENED).length;
        const totalWeeks = Math.ceil(days.length / 7);

        return { total: days.length, working, holidays, shortened, totalWeeks };
    }
}
