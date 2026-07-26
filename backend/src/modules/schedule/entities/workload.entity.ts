import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';
import { SchoolClass } from './school-class.entity';
import { ClassGroup } from './class-group.entity';
import { Subject } from './subject.entity';
import { Teacher } from './teacher.entity';
import { Room } from './room.entity';
import { LessonType } from './lesson-type.entity';
import { ScheduleLesson } from './schedule-lesson.entity';
import { WorkloadWeekType } from './enums';

// Реэкспорт для обратной совместимости
export { WorkloadWeekType } from './enums';

@Entity('workloads')
export class Workload {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'version_id' })
    versionId: number;

    @ManyToOne(() => ScheduleVersion, (version) => version.workloads, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'version_id' })
    version: ScheduleVersion;

    // Класс (обязательно)
    @Column({ name: 'class_id' })
    classId: number;

    @ManyToOne(() => SchoolClass, (cls) => cls.workloads)
    @JoinColumn({ name: 'class_id' })
    schoolClass: SchoolClass;

    // Группа (опционально - если null, то весь класс)
    @Column({ name: 'group_id', nullable: true })
    groupId: number;

    @ManyToOne(() => ClassGroup, (group) => group.workloads, { nullable: true })
    @JoinColumn({ name: 'group_id' })
    group: ClassGroup;

    // Предмет (обязательно)
    @Column({ name: 'subject_id' })
    subjectId: number;

    @ManyToOne(() => Subject, (subject) => subject.workloads)
    @JoinColumn({ name: 'subject_id' })
    subject: Subject;

    // Учитель (обязательно)
    @Column({ name: 'teacher_id' })
    teacherId: number;

    @ManyToOne(() => Teacher, (teacher) => teacher.workloads)
    @JoinColumn({ name: 'teacher_id' })
    teacher: Teacher;

    // Кабинет (опционально - если null, выбирается из допустимых)
    @Column({ name: 'room_id', nullable: true })
    roomId: number;

    @ManyToOne(() => Room, { nullable: true })
    @JoinColumn({ name: 'room_id' })
    room: Room;

    // Вид занятия (опционально)
    @Column({ name: 'lesson_type_id', nullable: true })
    lessonTypeId: number;

    @ManyToOne(() => LessonType, { nullable: true })
    @JoinColumn({ name: 'lesson_type_id' })
    lessonType: LessonType;

    // Количество часов в неделю
    @Column({ name: 'hours_per_week', type: 'int' })
    hoursPerWeek: number;

    // Тип недели (для двухнедельного расписания)
    @Column({
        name: 'week_type',
        type: 'enum',
        enum: WorkloadWeekType,
        default: WorkloadWeekType.BOTH,
    })
    weekType: WorkloadWeekType;

    // Сложность предмета (переопределение, если отличается от Subject)
    @Column({ type: 'int', nullable: true })
    difficulty: number;

    // Разрешить сдвоенные уроки (пары): два часа предмета подряд в один день.
    // По умолчанию false — часы распределяются по разным дням (норма для школы).
    // Включается для профильных предметов старших классов, где пары уместны.
    @Column({ name: 'allow_double_lessons', type: 'boolean', default: false })
    allowDoubleLessons: boolean;

    // Дополнительные классы (для объединённых уроков)
    @Column({ name: 'additional_class_ids', type: 'simple-array', nullable: true })
    additionalClassIds: number[];

    // Дополнительные учителя (для совместного преподавания)
    @Column({ name: 'additional_teacher_ids', type: 'simple-array', nullable: true })
    additionalTeacherIds: number[];

    // Примечания
    @Column({ type: 'text', nullable: true })
    notes: string;

    // Уроки в расписании для этой нагрузки
    @OneToMany(() => ScheduleLesson, (lesson) => lesson.workload)
    lessons: ScheduleLesson[];

    // Вычисляемое: сколько часов уже размещено
    get placedHours(): number {
        return this.lessons?.length || 0;
    }

    // Вычисляемое: сколько часов осталось разместить
    get remainingHours(): number {
        return this.hoursPerWeek - this.placedHours;
    }
}
