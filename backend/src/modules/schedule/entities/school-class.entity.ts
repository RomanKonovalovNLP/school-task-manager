import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { ClassGroup } from './class-group.entity';
import { Workload } from './workload.entity';

@Entity('school_classes')
export class SchoolClass {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ type: 'varchar', length: 20 })
    name: string; // "1А", "11Б"

    @Column({ name: 'grade_level', type: 'int' })
    gradeLevel: number; // 1-11

    @Column({ name: 'students_count', type: 'int', default: 25 })
    studentsCount: number;

    @Column({ name: 'max_lessons_per_day', type: 'int', nullable: true })
    maxLessonsPerDay: number; // Переопределение СанПиН если нужно

    @Column({ name: 'classroom_id', type: 'int', nullable: true })
    classroomId: number; // Закреплённый кабинет

    @Column({ type: 'varchar', length: 7, default: '#2196F3' })
    color: string;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @OneToMany(() => ClassGroup, (group) => group.schoolClass)
    groups: ClassGroup[];

    @OneToMany(() => Workload, (workload) => workload.schoolClass)
    workloads: Workload[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
