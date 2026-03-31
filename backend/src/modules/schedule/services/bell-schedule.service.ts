import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BellSchedule } from '../entities/bell-schedule.entity';

@Injectable()
export class BellScheduleService {
    constructor(
        @InjectRepository(BellSchedule)
        private bellRepo: Repository<BellSchedule>,
    ) {}

    /**
     * Получить все глобальные звонки школы (versionId = null, schoolId = schoolId)
     */
    async findAll(schoolId: number): Promise<BellSchedule[]> {
        return this.bellRepo.find({
            where: { schoolId },
            order: { shift: 'ASC', lessonNumber: 'ASC' },
        });
    }

    /**
     * Создать звонок
     */
    async create(
        dto: {
            lessonNumber: number;
            startTime: string;
            endTime: string;
            breakAfter?: number;
            name?: string;
            shift?: number;
        },
        schoolId: number,
    ): Promise<BellSchedule> {
        const bell: BellSchedule = this.bellRepo.create({
            schoolId,
            lessonNumber: dto.lessonNumber,
            startTime: dto.startTime,
            endTime: dto.endTime,
            breakAfter: dto.breakAfter ?? 10,
            name: dto.name,
            shift: dto.shift ?? 1,
        } as Partial<BellSchedule>);
        return this.bellRepo.save(bell);
    }

    /**
     * Обновить звонок
     */
    async update(
        id: number,
        dto: Partial<{
            lessonNumber: number;
            startTime: string;
            endTime: string;
            breakAfter: number;
            name: string;
            shift: number;
        }>,
        schoolId: number,
    ): Promise<BellSchedule> {
        const bell = await this.bellRepo.findOne({ where: { id, schoolId } });
        if (!bell) throw new NotFoundException('Звонок не найден');

        Object.assign(bell, dto);
        return this.bellRepo.save(bell);
    }

    /**
     * Удалить звонок
     */
    async remove(id: number, schoolId: number): Promise<void> {
        const bell = await this.bellRepo.findOne({ where: { id, schoolId } });
        if (!bell) throw new NotFoundException('Звонок не найден');
        await this.bellRepo.remove(bell);
    }
}
