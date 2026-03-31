import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Substitution } from '../entities/substitution.entity';
import { ScheduleLesson } from '../entities/schedule-lesson.entity';
import { Teacher } from '../entities/teacher.entity';
import { CreateSubstitutionDto } from '../dto/schedule.dto';

@Injectable()
export class SubstitutionsService {
    constructor(
        @InjectRepository(Substitution)
        private substitutionRepo: Repository<Substitution>,
        @InjectRepository(ScheduleLesson)
        private lessonRepo: Repository<ScheduleLesson>,
        @InjectRepository(Teacher)
        private teacherRepo: Repository<Teacher>,
    ) {}

    async findByDate(date: string, schoolId: number): Promise<{
        date: string;
        originalLessons: ScheduleLesson[];
        substitutions: Substitution[];
    }> {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay() || 7; // 1-7

        // Находим активное расписание для школы
        const lessons = await this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.version', 'version')
            .leftJoinAndSelect('workload.schoolClass', 'schoolClass')
            .leftJoinAndSelect('workload.subject', 'subject')
            .leftJoinAndSelect('workload.teacher', 'teacher')
            .leftJoinAndSelect('lesson.room', 'room')
            .where('version.schoolId = :schoolId', { schoolId })
            .andWhere('version.isActive = true')
            .andWhere('lesson.dayOfWeek = :dayOfWeek', { dayOfWeek })
            .orderBy('lesson.lessonNumber', 'ASC')
            .getMany();

        // Находим замены на эту дату
        const lessonIds = lessons.map(l => l.id);
        const substitutions = lessonIds.length > 0
            ? await this.substitutionRepo.find({
                where: {
                    lessonId: In(lessonIds),
                    date: dateObj,
                },
                relations: ['newTeacher', 'newRoom', 'newSubject'],
            })
            : [];

        return {
            date,
            originalLessons: lessons,
            substitutions,
        };
    }

    async create(dto: CreateSubstitutionDto, createdBy: string, schoolId: number): Promise<Substitution> {
        // Проверяем, что урок принадлежит школе
        const lesson = await this.lessonRepo.findOne({
            where: { id: dto.lessonId },
            relations: ['workload', 'workload.version'],
        });

        if (!lesson || lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Урок не найден');
        }

        // Проверяем, нет ли уже замены на эту дату
        const existing = await this.substitutionRepo.findOne({
            where: { lessonId: dto.lessonId, date: new Date(dto.date) },
        });

        if (existing) {
            // Обновляем существующую замену
            Object.assign(existing, {
                newTeacherId: dto.newTeacherId,
                newRoomId: dto.newRoomId,
                newSubjectId: dto.newSubjectId,
                isCancelled: dto.isCancelled,
                reason: dto.reason,
            });
            return this.substitutionRepo.save(existing);
        }

        // Создаём новую замену
        const substitution = this.substitutionRepo.create({
            lessonId: dto.lessonId,
            date: new Date(dto.date),
            newTeacherId: dto.newTeacherId,
            newRoomId: dto.newRoomId,
            newSubjectId: dto.newSubjectId,
            isCancelled: dto.isCancelled || false,
            reason: dto.reason,
            createdBy,
        });

        return this.substitutionRepo.save(substitution);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const substitution = await this.substitutionRepo.findOne({
            where: { id },
            relations: ['lesson', 'lesson.workload', 'lesson.workload.version'],
        });

        if (!substitution || substitution.lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Замена не найдена');
        }

        await this.substitutionRepo.remove(substitution);
    }

    // Найти доступных учителей для замены
    async getAvailableTeachers(lessonId: number, date: string, schoolId: number): Promise<{
        availableTeachers: {
            id: number;
            name: string;
            subjects: string[];
            currentLoad: number;
            suitability: number;
        }[];
    }> {
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId },
            relations: ['workload', 'workload.version', 'workload.subject'],
        });

        if (!lesson || lesson.workload.version.schoolId !== schoolId) {
            throw new NotFoundException('Урок не найден');
        }

        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay() || 7;

        // Получаем всех учителей школы
        const teachers = await this.teacherRepo.find({
            where: { schoolId, isActive: true },
            relations: ['subjects', 'availability'],
        });

        // Получаем уроки на этот день
        const dayLessons = await this.lessonRepo
            .createQueryBuilder('lesson')
            .leftJoinAndSelect('lesson.workload', 'workload')
            .leftJoinAndSelect('workload.version', 'version')
            .where('version.schoolId = :schoolId', { schoolId })
            .andWhere('version.isActive = true')
            .andWhere('lesson.dayOfWeek = :dayOfWeek', { dayOfWeek })
            .getMany();

        const result = teachers.map(teacher => {
            // Проверяем доступность
            const availabilityRecord = teacher.availability?.find(
                a => a.dayOfWeek === dayOfWeek && a.lessonNumber === lesson.lessonNumber
            );

            if (availabilityRecord && !availabilityRecord.isAvailable) {
                return null; // Учитель недоступен
            }

            // Проверяем, не занят ли учитель в это время
            const isOccupied = dayLessons.some(
                l => l.workload.teacherId === teacher.id &&
                     l.lessonNumber === lesson.lessonNumber &&
                     l.id !== lesson.id
            );

            if (isOccupied) {
                return null;
            }

            // Считаем нагрузку на этот день
            const currentLoad = dayLessons.filter(
                l => l.workload.teacherId === teacher.id
            ).length;

            // Определяем подходящесть (ведёт ли этот предмет)
            const teachesSubject = teacher.subjects?.some(
                s => s.id === lesson.workload.subjectId
            );

            return {
                id: teacher.id,
                name: teacher.shortName || teacher.fullName,
                subjects: teacher.subjects?.map(s => s.name) || [],
                currentLoad,
                suitability: teachesSubject ? 100 : 50,
            };
        }).filter(t => t !== null) as any[];

        // Сортируем: сначала те, кто ведёт предмет
        result.sort((a, b) => b.suitability - a.suitability || a.currentLoad - b.currentLoad);

        return { availableTeachers: result };
    }
}
