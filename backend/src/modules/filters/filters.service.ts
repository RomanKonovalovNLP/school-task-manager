import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilterCategory } from './entities/filter-category.entity';

@Injectable()
export class FiltersService {
    constructor(
        @InjectRepository(FilterCategory)
        private categoryRepository: Repository<FilterCategory>,
    ) { }

    /**
     * Создать тестовые категории
     */
    async seedCategories(schoolId: number) {
        const defaultCategories = [
            'Учителя математики',
            'Учителя русского языка',
            'Учителя английского языка',
            'Завучи',
            'Директор',
            'Классные руководители',
            'Все учителя',
        ];

        const created: FilterCategory[] = [];

        for (const categoryName of defaultCategories) {
            try {
                const category = this.categoryRepository.create({
                    schoolId,
                    categoryName,
                });
                const saved = await this.categoryRepository.save(category);
                created.push(saved);
            } catch (error) {
                // Категория уже существует, пропускаем
            }
        }

        return {
            message: 'Тестовые категории созданы',
            count: created.length,
            categories: created,
        };
    }

    /**
     * Получить все категории школы
     */
    async findAll(schoolId: number) {
        return this.categoryRepository.find({
            where: { schoolId },
            order: { categoryName: 'ASC' },
        });
    }

    /**
     * Создать новую категорию (только админы)
     */
    async create(schoolId: number, categoryName: string) {
        const existing = await this.categoryRepository.findOne({
            where: { schoolId, categoryName },
        });

        if (existing) {
            throw new ConflictException('Категория с таким названием уже существует');
        }

        const category = this.categoryRepository.create({
            schoolId,
            categoryName,
        });

        return this.categoryRepository.save(category);
    }

    /**
     * Удалить категорию (только админы)
     */
    async remove(id: number, schoolId: number) {
        const result = await this.categoryRepository.delete({ id, schoolId });

        if (result.affected === 0) {
            throw new ConflictException('Категория не найдена');
        }

        return { message: 'Категория удалена', id };
    }
}
