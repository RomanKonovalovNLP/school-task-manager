import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilterCategory } from './entities/filter-category.entity';
import { UserCategory } from './entities/user-category.entity';
import { UserProfile } from '../users/entities/user-profile.entity';

@Injectable()
export class FiltersService {
    constructor(
        @InjectRepository(FilterCategory)
        private filterCategoryRepo: Repository<FilterCategory>,
        @InjectRepository(UserCategory)
        private userCategoryRepo: Repository<UserCategory>,
        @InjectRepository(UserProfile)
        private userProfileRepo: Repository<UserProfile>,
    ) { }

    /**
     * Получить или создать профиль пользователя
     */
    private async getOrCreateUserProfile(schoolId: number, fullName: string): Promise<UserProfile> {
        let profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });

        if (!profile) {
            profile = this.userProfileRepo.create({
                schoolId,
                fullName,
            });
            profile = await this.userProfileRepo.save(profile);
        }

        return profile;
    }

    /**
     * Получить все категории школы
     */
    async findAll(schoolId: number): Promise<FilterCategory[]> {
        return this.filterCategoryRepo.find({
            where: { schoolId },
            order: { categoryName: 'ASC' },
        });
    }

    /**
     * Создать категорию (только админ)
     */
    async create(
        schoolId: number,
        categoryName: string,
        isAdmin: boolean,
    ): Promise<FilterCategory> {
        if (!isAdmin) {
            throw new ForbiddenException('Только администраторы могут создавать категории');
        }

        // Проверка на дубликаты
        const existing = await this.filterCategoryRepo.findOne({
            where: { schoolId, categoryName },
        });

        if (existing) {
            throw new ConflictException('Категория с таким именем уже существует');
        }

        const category = this.filterCategoryRepo.create({
            schoolId,
            categoryName,
        });

        return this.filterCategoryRepo.save(category);
    }

    /**
     * Обновить категорию (только админ)
     */
    async update(
        id: number,
        schoolId: number,
        categoryName: string,
        isAdmin: boolean,
    ): Promise<FilterCategory> {
        if (!isAdmin) {
            throw new ForbiddenException('Только администраторы могут редактировать категории');
        }

        const category = await this.filterCategoryRepo.findOne({
            where: { id, schoolId },
        });

        if (!category) {
            throw new NotFoundException('Категория не найдена');
        }

        // Проверка на дубликаты (кроме текущей)
        const duplicate = await this.filterCategoryRepo.findOne({
            where: { schoolId, categoryName },
        });

        if (duplicate && duplicate.id !== id) {
            throw new ConflictException('Категория с таким именем уже существует');
        }

        category.categoryName = categoryName;
        return this.filterCategoryRepo.save(category);
    }

    /**
     * Удалить категорию (только админ)
     */
    async remove(id: number, schoolId: number, isAdmin: boolean): Promise<void> {
        if (!isAdmin) {
            throw new ForbiddenException('Только администраторы могут удалять категории');
        }

        const category = await this.filterCategoryRepo.findOne({
            where: { id, schoolId },
        });

        if (!category) {
            throw new NotFoundException('Категория не найдена');
        }

        await this.filterCategoryRepo.remove(category);
    }

    /**
     * Создать дефолтные категории (seed)
     */
    async seedCategories(schoolId: number): Promise<void> {
        const defaultCategories = [
            'Учителя',
            'Администрация',
            'Завучи',
            'Психологи',
            'Библиотекари',
            'Технический персонал',
        ];

        for (const categoryName of defaultCategories) {
            const existing = await this.filterCategoryRepo.findOne({
                where: { schoolId, categoryName },
            });

            if (!existing) {
                const category = this.filterCategoryRepo.create({
                    schoolId,
                    categoryName,
                });
                await this.filterCategoryRepo.save(category);
            }
        }
    }

    /**
     * ИСПРАВЛЕНО: Получить категории пользователя по профилю (не сессии)
     */
    async getUserCategories(schoolId: number, fullName: string): Promise<string[]> {
        const profile = await this.userProfileRepo.findOne({
            where: { schoolId, fullName },
        });

        if (!profile) {
            return [];
        }

        const userCategories = await this.userCategoryRepo.find({
            where: { userProfileId: profile.id },
            relations: ['category'],
        });

        return userCategories.map((uc) => uc.category.categoryName);
    }

    /**
     * ИСПРАВЛЕНО: Установить категории пользователя по профилю
     */
    async setUserCategories(
        schoolId: number,
        fullName: string,
        categoryIds: number[],
    ): Promise<void> {
        // Получаем или создаем профиль
        const profile = await this.getOrCreateUserProfile(schoolId, fullName);

        // Удаляем старые категории
        await this.userCategoryRepo.delete({ userProfileId: profile.id });

        // Добавляем новые
        const userCategories = categoryIds.map((categoryId) =>
            this.userCategoryRepo.create({
                userProfileId: profile.id,
                categoryId,
            }),
        );

        if (userCategories.length > 0) {
            await this.userCategoryRepo.save(userCategories);
        }
    }

    /**
     * Проверить, принадлежит ли пользователь категории
     */
    async userHasCategory(
        schoolId: number,
        fullName: string,
        categoryName: string,
    ): Promise<boolean> {
        const categories = await this.getUserCategories(schoolId, fullName);
        return categories.includes(categoryName);
    }
}
