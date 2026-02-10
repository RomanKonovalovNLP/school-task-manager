import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ScheduleLesson } from './schedule-lesson.entity';
import { Teacher } from './teacher.entity';
import { Room } from './room.entity';
import { Subject } from './subject.entity';

@Entity('substitutions')
@Index(['date'])
@Index(['lessonId', 'date'], { unique: true })
export class Substitution {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'lesson_id' })
    lessonId: number;

    @ManyToOne(() => ScheduleLesson, (lesson) => lesson.substitutions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lesson_id' })
    lesson: ScheduleLesson;

    // Дата замены
    @Column({ type: 'date' })
    date: Date;

    // Новый учитель (null = тот же учитель)
    @Column({ name: 'new_teacher_id', nullable: true })
    newTeacherId: number;

    @ManyToOne(() => Teacher, { nullable: true })
    @JoinColumn({ name: 'new_teacher_id' })
    newTeacher: Teacher;

    // Новый кабинет (null = тот же кабинет)
    @Column({ name: 'new_room_id', nullable: true })
    newRoomId: number;

    @ManyToOne(() => Room, { nullable: true })
    @JoinColumn({ name: 'new_room_id' })
    newRoom: Room;

    // Новый предмет (null = тот же предмет)
    @Column({ name: 'new_subject_id', nullable: true })
    newSubjectId: number;

    @ManyToOne(() => Subject, { nullable: true })
    @JoinColumn({ name: 'new_subject_id' })
    newSubject: Subject;

    // Урок отменён
    @Column({ name: 'is_cancelled', type: 'boolean', default: false })
    isCancelled: boolean;

    // Причина замены
    @Column({ type: 'varchar', length: 255, nullable: true })
    reason: string;

    // Кто создал замену
    @Column({ name: 'created_by', type: 'varchar', length: 255 })
    createdBy: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
