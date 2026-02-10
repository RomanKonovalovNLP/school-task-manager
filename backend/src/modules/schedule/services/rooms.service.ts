import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomType } from '../entities/room.entity';
import { CreateRoomDto } from '../dto/schedule.dto';

@Injectable()
export class RoomsService {
    constructor(
        @InjectRepository(Room)
        private roomRepo: Repository<Room>,
    ) {}

    async findAll(schoolId: number): Promise<Room[]> {
        return this.roomRepo.find({
            where: { schoolId, isActive: true },
            order: { name: 'ASC' },
        });
    }

    async findOne(id: number, schoolId: number): Promise<Room> {
        const room = await this.roomRepo.findOne({
            where: { id, schoolId },
        });
        if (!room) {
            throw new NotFoundException('Кабинет не найден');
        }
        return room;
    }

    async create(dto: CreateRoomDto, schoolId: number): Promise<Room> {
        const room = this.roomRepo.create({
            ...dto,
            schoolId,
            type: (dto.type as RoomType) || RoomType.REGULAR,
        });
        return this.roomRepo.save(room);
    }

    async update(id: number, dto: Partial<CreateRoomDto>, schoolId: number): Promise<Room> {
        const room = await this.findOne(id, schoolId);
        Object.assign(room, dto);
        return this.roomRepo.save(room);
    }

    async remove(id: number, schoolId: number): Promise<void> {
        const room = await this.findOne(id, schoolId);
        room.isActive = false;
        await this.roomRepo.save(room);
    }

    // Проверить занятость кабинета в слоте
    async isOccupied(
        roomId: number,
        versionId: number,
        dayOfWeek: number,
        lessonNumber: number,
        excludeLessonId?: number,
    ): Promise<boolean> {
        const query = this.roomRepo
            .createQueryBuilder('room')
            .innerJoin('schedule_lessons', 'sl', 'sl.room_id = room.id')
            .where('room.id = :roomId', { roomId })
            .andWhere('sl.version_id = :versionId', { versionId })
            .andWhere('sl.day_of_week = :dayOfWeek', { dayOfWeek })
            .andWhere('sl.lesson_number = :lessonNumber', { lessonNumber });

        if (excludeLessonId) {
            query.andWhere('sl.id != :excludeLessonId', { excludeLessonId });
        }

        const count = await query.getCount();
        return count > 0;
    }
}
