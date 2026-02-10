import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    ManyToMany,
    JoinColumn,
    JoinTable,
    OneToMany,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Teacher } from './teacher.entity';
import { Room } from './room.entity';
import { Workload } from './workload.entity';
import { SanpinCategory } from './enums';

// Реэкспорт для обратной совместимости
export { SanpinCategory } from './enums';

@Entity('subjects')
export class Subject {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 255 })
    name: string; // "Математика", "Английский язык"

    @Column({ name: 'short_name', type: 'varchar', length: 50 })
    shortName: string; // "Мат", "Англ"

    @Column({ type: 'varchar', length: 7, default: '#FF9800' })
    color: string;

    @Column({
        name: 'sanpin_category',
        type: 'enum',
        enum: SanpinCategory,
        default: SanpinCategory.OTHER,
    })
    sanpinCategory: SanpinCategory;

    @Column({ type: 'int', default: 5 })
    difficulty: number; // 1-13 по шкале СанПиН

    @Column({ name: 'requires_special_room', type: 'boolean', default: false })
    requiresSpecialRoom: boolean; // Требует спец. кабинет (физика, химия)

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    // Учителя, которые могут вести этот предмет
    @ManyToMany(() => Teacher, (teacher) => teacher.subjects)
    teachers: Teacher[];

    // Кабинеты, в которых можно проводить этот предмет
    @ManyToMany(() => Room)
    @JoinTable({
        name: 'subject_rooms',
        joinColumn: { name: 'subject_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'room_id', referencedColumnName: 'id' },
    })
    allowedRooms: Room[];

    @OneToMany(() => Workload, (workload) => workload.subject)
    workloads: Workload[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
