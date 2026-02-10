import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from '../entities/school-class.entity';
import { ClassGroup } from '../entities/class-group.entity';
import { CreateClassDto } from '../dto/schedule.dto';

@Injectable()
export class ClassesService {
    constructor(
        @InjectRepository(SchoolClass)
        private classRepo: Repository<SchoolClass>,
        @InjectRepository(ClassGroup)
        private groupRepo: Repository<ClassGroup>,
    ) {}

    async findAll(schoolId: number): Promise<SchoolClass[]> {
        return this.classRepo.find({
            where: { schoolId, isActive: true },
            relations: ['groups'],
            order: { gradeLevel: 'ASC', name: 'ASC' },
        });
    }

    async findOne(id: number, schoolId: number): Promise<SchoolClass> {
        const schoolClass = await this.classRepo.findOne({
            where: { id, schoolId },
            relations: ['groups'],
        });
        if (!schoolClass) {
            throw new NotFoundException('Класс не найден');
        }
        return schoolClass;
    }

    async create(dto: CreateClassDto, schoolId: number): Promise<SchoolClass> {
        const schoolClass = this.classRepo.create({
            ...dto,
            schoolId,
        });
        return this.classRepo.save(schoolClass);
    }

    async update(id: number, dto: Partial<CreateClassDto>, schoolId: number): Promise<SchoolClass> {
        const schoolClass = await this.findOne(id, schoolId);
        Object.assign(schoolClass, dto);
        return this.classRepo.save(schoolClass);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const schoolClass = await this.findOne(id, schoolId);
        schoolClass.isActive = false;
        await this.classRepo.save(schoolClass);
    }

    // Группы класса
    async addGroup(classId: number, name: string, studentsCount?: number, schoolId?: number): Promise<ClassGroup> {
        if (schoolId) {
            await this.findOne(classId, schoolId); // Проверка доступа
        }
        const group = this.groupRepo.create({
            classId,
            name,
            studentsCount,
        });
        return this.groupRepo.save(group);
    }

    async removeGroup(groupId: number): Promise<void> {
        await this.groupRepo.delete(groupId);
    }
}
