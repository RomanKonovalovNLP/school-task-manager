import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    ManyToMany,
    JoinColumn,
    JoinTable,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Subject } from './subject.entity';
import { Room } from './room.entity';
import { TeacherAvailability } from './teacher-availability.entity';
import { Workload } from './workload.entity';

@Entity('teachers')
export class Teacher {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'school_id' })
    schoolId: number;

    @ManyToOne(() => School)
    @JoinColumn({ name: 'school_id' })
    school: School;

    @Column({ name: 'full_name', type: 'varchar', length: 255 })
    fullName: string;

    @Column({ name: 'short_name', type: 'varchar', length: 100 })
    shortName: string; // "Иванова А.П."

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 7, default: '#4CAF50' })
    color: string;

    @Column({ name: 'max_lessons_per_day', type: 'int', default: 6 })
    maxLessonsPerDay: number;

    @Column({ name: 'max_windows_per_day', type: 'int', default: 1 })
    maxWindowsPerDay: number;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    // Предметы, которые ведёт учитель
    @ManyToMany(() => Subject, (subject) => subject.teachers)
    @JoinTable({
        name: 'teacher_subjects',
        joinColumn: { name: 'teacher_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'subject_id', referencedColumnName: 'id' },
    })
    subjects: Subject[];

    // Предпочтительные кабинеты учителя
    @ManyToMany(() => Room)
    @JoinTable({
        name: 'teacher_rooms',
        joinColumn: { name: 'teacher_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'room_id', referencedColumnName: 'id' },
    })
    preferredRooms: Room[];

    @OneToMany(() => TeacherAvailability, (avail) => avail.teacher)
    availability: TeacherAvailability[];

    @OneToMany(() => Workload, (workload) => workload.teacher)
    workloads: Workload[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
