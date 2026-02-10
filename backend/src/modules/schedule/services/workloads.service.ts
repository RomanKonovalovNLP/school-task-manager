import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workload } from '../entities/workload.entity';
import { CreateWorkloadDto, UpdateWorkloadDto } from '../dto/schedule.dto';
import { ScheduleVersionsService } from './schedule-versions.service';

@Injectable()
export class WorkloadsService {
    constructor(
        @InjectRepository(Workload)
        private workloadRepo: Repository<Workload>,
        private versionsService: ScheduleVersionsService,
    ) {}

    async findAll(versionId: number, schoolId: number): Promise<Workload[]> {
        await this.versionsService.checkAccess(versionId, schoolId);

        return this.workloadRepo.find({
            where: { versionId },
            relations: ['schoolClass', 'group', 'subject', 'teacher', 'room', 'lessonType', 'lessons'],
            order: { classId: 'ASC' },
        });
    }

    async findOne(id: number, schoolId: number): Promise<Workload> {
        const workload = await this.workloadRepo.findOne({
            where: { id },
            relations: ['schoolClass', 'group', 'subject', 'teacher', 'room', 'lessonType', 'lessons', 'version'],
        });

        if (!workload) {
            throw new NotFoundException('Нагрузка не найдена');
        }

        // Проверяем доступ через версию
        if (workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Нагрузка не найдена');
        }

        return workload;
    }

    async create(versionId: number, dto: CreateWorkloadDto, schoolId: number): Promise<Workload> {
        await this.versionsService.checkAccess(versionId, schoolId);

        const workload = this.workloadRepo.create({
            ...dto,
            versionId,
        });

        return this.workloadRepo.save(workload);
    }

    async update(id: number, dto: UpdateWorkloadDto, schoolId: number): Promise<Workload> {
        const workload = await this.findOne(id, schoolId);
        Object.assign(workload, dto);
        return this.workloadRepo.save(workload);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const workload = await this.findOne(id, schoolId);
        await this.workloadRepo.remove(workload);
    }

    // Получить неразмещённую нагрузку
    async getUnplaced(versionId: number, schoolId: number): Promise<Workload[]> {
        await this.versionsService.checkAccess(versionId, schoolId);

        const workloads = await this.workloadRepo.find({
            where: { versionId },
            relations: ['schoolClass', 'group', 'subject', 'teacher', 'lessons'],
        });

        return workloads.filter(w => (w.lessons?.length || 0) < w.hoursPerWeek);
    }
}
