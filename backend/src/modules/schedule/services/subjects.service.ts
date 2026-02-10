import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, SanpinCategory } from '../entities/subject.entity';
import { CreateSubjectDto } from '../dto/schedule.dto';
import { DEFAULT_SANPIN_RULES } from '../solver/sanpin-rules.service';

@Injectable()
export class SubjectsService {
    constructor(
        @InjectRepository(Subject)
        private subjectRepo: Repository<Subject>,
    ) {}

    async findAll(schoolId: number): Promise<Subject[]> {
        return this.subjectRepo.find({
            where: { schoolId, isActive: true },
            relations: ['allowedRooms'],
            order: { name: 'ASC' },
        });
    }

    async findOne(id: number, schoolId: number): Promise<Subject> {
        const subject = await this.subjectRepo.findOne({
            where: { id, schoolId },
            relations: ['allowedRooms'],
        });
        if (!subject) {
            throw new NotFoundException('Предмет не найден');
        }
        return subject;
    }

    async create(dto: CreateSubjectDto, schoolId: number): Promise<Subject> {
        // Определяем категорию СанПиН
        const sanpinCategory = this.detectSanpinCategory(dto.name);
        
        // Определяем сложность по СанПиН если не указана
        const difficulty = dto.difficulty || DEFAULT_SANPIN_RULES.SUBJECT_DIFFICULTY[sanpinCategory] || 5;

        const subject = this.subjectRepo.create({
            ...dto,
            schoolId,
            sanpinCategory,
            difficulty,
        });

        return this.subjectRepo.save(subject);
    }

    async update(id: number, dto: Partial<CreateSubjectDto>, schoolId: number): Promise<Subject> {
        const subject = await this.findOne(id, schoolId);
        
        if (dto.name && dto.name !== subject.name) {
            // Пересчитываем категорию СанПиН при изменении названия
            subject.sanpinCategory = this.detectSanpinCategory(dto.name);
        }

        Object.assign(subject, dto);
        return this.subjectRepo.save(subject);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const subject = await this.findOne(id, schoolId);
        subject.isActive = false;
        await this.subjectRepo.save(subject);
    }

    // Автоопределение категории СанПиН по названию
    private detectSanpinCategory(name: string): SanpinCategory {
        const nameLower = name.toLowerCase();

        const categoryMap: Record<string, SanpinCategory> = {
            'математ': SanpinCategory.MATHEMATICS,
            'алгебра': SanpinCategory.MATHEMATICS,
            'геометри': SanpinCategory.MATHEMATICS,
            'англ': SanpinCategory.FOREIGN_LANGUAGE,
            'немец': SanpinCategory.FOREIGN_LANGUAGE,
            'франц': SanpinCategory.FOREIGN_LANGUAGE,
            'иностран': SanpinCategory.FOREIGN_LANGUAGE,
            'физик': SanpinCategory.PHYSICS,
            'хими': SanpinCategory.CHEMISTRY,
            'русск': SanpinCategory.RUSSIAN_LANGUAGE,
            'литератур': SanpinCategory.LITERATURE,
            'биолог': SanpinCategory.BIOLOGY,
            'информатик': SanpinCategory.INFORMATICS,
            'географ': SanpinCategory.GEOGRAPHY,
            'истори': SanpinCategory.HISTORY,
            'обществ': SanpinCategory.SOCIAL_STUDIES,
            'астроном': SanpinCategory.ASTRONOMY,
            'музык': SanpinCategory.MUSIC,
            'изо': SanpinCategory.ART,
            'рисован': SanpinCategory.ART,
            'технолог': SanpinCategory.TECHNOLOGY,
            'труд': SanpinCategory.TECHNOLOGY,
            'физкульт': SanpinCategory.PHYSICAL_EDUCATION,
            'физ-ра': SanpinCategory.PHYSICAL_EDUCATION,
        };

        for (const [key, category] of Object.entries(categoryMap)) {
            if (nameLower.includes(key)) {
                return category;
            }
        }

        return SanpinCategory.OTHER;
    }
}
