import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { SchoolClass } from './school-class.entity';
import { Workload } from './workload.entity';

@Entity('class_groups')
export class ClassGroup {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'class_id' })
    classId: number;

    @ManyToOne(() => SchoolClass, (cls) => cls.groups, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'class_id' })
    schoolClass: SchoolClass;

    @Column({ type: 'varchar', length: 100 })
    name: string; // "Группа 1", "Английский - группа А"

    @Column({ name: 'students_count', type: 'int', nullable: true })
    studentsCount: number;

    @Column({ name: 'sort_order', type: 'int', default: 0 })
    sortOrder: number;

    @OneToMany(() => Workload, (workload) => workload.group)
    workloads: Workload[];
}
