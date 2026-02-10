import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Workload, WorkloadWeekType } from '../entities/workload.entity';
import { CreateLessonDto, UpdateLessonDto, MoveLessonDto } from '../dto/schedule.dto';
import { ScheduleVersionsService } from './schedule-versions.service';

@Injectable()
export class LessonsService {
    constructor(
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Workload)
        private workloadRepo: Repository<Workload>,
        private versionsService: ScheduleVersionsService,
    ) {}

    async findOne(id: number, schoolId: number): Promise<ScheduleLesson> {
        const lesson = await this.lessonRepo.findOne({
            where: { id },
            relations: ['workload', 'workload.version', 'workload.schoolClass', 'workload.subject', 'workload.teacher', 'room'],
        });

        if (!lesson) {
            throw new NotFoundException('Урок не найден');
        }

        if (lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Урок не найден');
        }

        return lesson;
    }

    async create(dto: CreateLessonDto, schoolId: number): Promise<ScheduleLesson> {
        const workload = await this.workloadRepo.findOne({
            where: { id: dto.workloadId },
            relations: ['version', 'schoolClass', 'subject', 'teacher'],
        });

        if (!workload || workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Нагрузка не найдена');
        }

        const lesson = this.lessonRepo.create({
            versionId: workload.versionId,
            workloadId: dto.workloadId,
            dayOfWeek: dto.dayOfWeek,
            lessonNumber: dto.lessonNumber,
            weekType: dto.weekType || WorkloadWeekType.BOTH,
            roomId: dto.roomId || workload.roomId,
        });

        const savedLesson = await this.lessonRepo.save(lesson);

        // Возвращаем с полными данными
        return this.findOne(savedLesson.id, schoolId);
    }

    async update(id: number, dto: UpdateLessonDto, schoolId: number): Promise<ScheduleLesson> {
        const lesson = await this.findOne(id, schoolId);
        Object.assign(lesson, dto);
        const saved = await this.lessonRepo.save(lesson);
        return this.findOne(saved.id, schoolId);
    }

    async move(id: number, dto: MoveLessonDto, schoolId: number): Promise<ScheduleLesson> {
        const lesson = await this.findOne(id, schoolId);

        lesson.dayOfWeek = dto.dayOfWeek;
        lesson.lessonNumber = dto.lessonNumber;

        if (dto.weekType !== undefined) {
            lesson.weekType = dto.weekType;
        }

        if (dto.roomId !== undefined) {
            lesson.roomId = dto.roomId;
        }

        const saved = await this.lessonRepo.save(lesson);
        return this.findOne(saved.id, schoolId);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const lesson = await this.findOne(id, schoolId);
        await this.lessonRepo.remove(lesson);
    }

    async toggleLock(id: number, schoolId: number): Promise<ScheduleLesson> {
        const lesson = await this.findOne(id, schoolId);
        lesson.isLocked = !lesson.isLocked;
        const saved = await this.lessonRepo.save(lesson);
        return this.findOne(saved.id, schoolId);
    }

    // Получить информацию о слоте
    async getSlotInfo(
        versionId: number,
        dayOfWeek: number,
        lessonNumber: number,
        weekType: WorkloadWeekType,
        schoolId: number,
    ): Promise<{
        lessons: ScheduleLesson[];
        isAvailable: boolean;
    }> {
        await this.versionsService.checkAccess(versionId, schoolId);

        const lessons = await this.lessonRepo.find({
            where: { versionId, dayOfWeek, lessonNumber },
            relations: ['workload', 'workload.schoolClass', 'workload.subject', 'workload.teacher', 'room'],
        });

        // Фильтруем по типу недели
        const filteredLessons = lessons.filter(l => {
            if (weekType === WorkloadWeekType.BOTH) return true;
            if (l.weekType === WorkloadWeekType.BOTH) return true;
            return l.weekType === weekType;
        });

        return {
            lessons: filteredLessons,
            isAvailable: filteredLessons.length === 0,
        };
    }
}
