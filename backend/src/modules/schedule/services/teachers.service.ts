import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Teacher } from '../entities/teacher.entity';
import { TeacherAvailability } from '../entities/teacher-availability.entity';
import { Subject } from '../entities/subject.entity';
import { CreateTeacherDto } from '../dto/schedule.dto';

@Injectable()
export class TeachersService {
    constructor(
        @InjectRepository(Teacher)
        private teacherRepo: Repository<Teacher>,
        @InjectRepository(TeacherAvailability)
        private availabilityRepo: Repository<TeacherAvailability>,
        @InjectRepository(Subject)
        private subjectRepo: Repository<Subject>,
    ) {}

    async findAll(schoolId: number): Promise<Teacher[]> {
        return this.teacherRepo.find({
            where: { schoolId, isActive: true },
            relations: ['subjects', 'preferredRooms', 'availability'],
            order: { fullName: 'ASC' },
        });
    }

    async findOne(id: number, schoolId: number): Promise<Teacher> {
        const teacher = await this.teacherRepo.findOne({
            where: { id, schoolId },
            relations: ['subjects', 'preferredRooms', 'availability'],
        });
        if (!teacher) {
            throw new NotFoundException('Учитель не найден');
        }
        return teacher;
    }

    async create(dto: CreateTeacherDto, schoolId: number): Promise<Teacher> {
        const teacher = this.teacherRepo.create({
            ...dto,
            schoolId,
        });

        // Связываем с предметами
        if (dto.subjectIds?.length) {
            teacher.subjects = await this.subjectRepo.find({
                where: { id: In(dto.subjectIds), schoolId },
            });
        }

        return this.teacherRepo.save(teacher);
    }

    async update(id: number, dto: Partial<CreateTeacherDto>, schoolId: number): Promise<Teacher> {
        const teacher = await this.findOne(id, schoolId);
        
        if (dto.subjectIds) {
            teacher.subjects = await this.subjectRepo.find({
                where: { id: In(dto.subjectIds), schoolId },
            });
        }

        Object.assign(teacher, dto);
        delete (teacher as any).subjectIds;
        
        return this.teacherRepo.save(teacher);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const teacher = await this.findOne(id, schoolId);
        teacher.isActive = false;
        await this.teacherRepo.save(teacher);
    }

    // Управление доступностью
    async setAvailability(
        teacherId: number,
        dayOfWeek: number,
        lessonNumber: number,
        isAvailable: boolean,
        preference: number = 0,
        schoolId?: number,
    ): Promise<TeacherAvailability> {
        if (schoolId) {
            await this.findOne(teacherId, schoolId);
        }

        let availability = await this.availabilityRepo.findOne({
            where: { teacherId, dayOfWeek, lessonNumber },
        });

        if (availability) {
            availability.isAvailable = isAvailable;
            availability.preference = preference;
        } else {
            availability = this.availabilityRepo.create({
                teacherId,
                dayOfWeek,
                lessonNumber,
                isAvailable,
                preference,
            });
        }

        return this.availabilityRepo.save(availability);
    }

    async getAvailability(teacherId: number): Promise<TeacherAvailability[]> {
        return this.availabilityRepo.find({
            where: { teacherId },
            order: { dayOfWeek: 'ASC', lessonNumber: 'ASC' },
        });
    }
}
