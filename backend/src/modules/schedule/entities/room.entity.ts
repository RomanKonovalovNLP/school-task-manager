import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { ScheduleLesson } from './schedule-lesson.entity';
import { RoomType } from './enums';

// Реэкспорт для обратной совместимости
export { RoomType } from './enums';

@Entity('rooms')
export class Room {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 50 })
    name: string; // "101", "Спортзал", "Каб. физики"

    @Column({ type: 'int', default: 30 })
    capacity: number; // Вместимость

    @Column({ type: 'int', nullable: true })
    floor: number; // Этаж

    @Column({
        type: 'enum',
        enum: RoomType,
        default: RoomType.REGULAR,
    })
    type: RoomType;

    @Column({ type: 'simple-array', nullable: true })
    equipment: string[]; // ["проектор", "интерактивная_доска"]

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @OneToMany(() => ScheduleLesson, (lesson) => lesson.room)
    lessons: ScheduleLesson[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
