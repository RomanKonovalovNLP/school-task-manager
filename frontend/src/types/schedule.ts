// ==================== Enums ====================

export enum ScheduleVersionType {
    TEMPLATE = 'template',
    PERIOD = 'period',
    SUBSTITUTION = 'substitution',
}

export enum WeekType {
    SINGLE = 'single',
    ODD_EVEN = 'odd_even',
}

export enum ScheduleStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

export enum WorkloadWeekType {
    BOTH = 'both',
    ODD = 'odd',
    EVEN = 'even',
}

export enum ConflictType {
    HARD = 'hard',
    SOFT = 'soft',
}

export enum ConflictCategory {
    TEACHER_CONFLICT = 'teacher_conflict',
    CLASS_CONFLICT = 'class_conflict',
    ROOM_CONFLICT = 'room_conflict',
    ROOM_CAPACITY = 'room_capacity',
    SANPIN_MAX_LESSONS = 'sanpin_max_lessons',
    SANPIN_MAX_DIFFICULTY = 'sanpin_max_difficulty',
    SANPIN_SUBJECT_PLACEMENT = 'sanpin_subject_placement',
    TEACHER_UNAVAILABLE = 'teacher_unavailable',
    TEACHER_WINDOW = 'teacher_window',
    CLASS_WINDOW = 'class_window',
    UNEVEN_DISTRIBUTION = 'uneven_distribution',
    WORKLOAD_NOT_PLACED = 'workload_not_placed',
}

export enum RoomType {
    REGULAR = 'regular',
    COMPUTER = 'computer',
    LABORATORY = 'laboratory',
    GYM = 'gym',
    WORKSHOP = 'workshop',
    MUSIC = 'music',
    ART = 'art',
    ASSEMBLY = 'assembly',
    LIBRARY = 'library',
}

export enum SanpinCategory {
    MATHEMATICS = 'математика',
    FOREIGN_LANGUAGE = 'иностранный_язык',
    PHYSICS = 'физика',
    CHEMISTRY = 'химия',
    RUSSIAN_LANGUAGE = 'русский_язык',
    LITERATURE = 'литература',
    BIOLOGY = 'биология',
    INFORMATICS = 'информатика',
    GEOGRAPHY = 'география',
    HISTORY = 'история',
    SOCIAL_STUDIES = 'обществознание',
    ASTRONOMY = 'астрономия',
    MUSIC = 'музыка',
    ART = 'изо',
    TECHNOLOGY = 'технология',
    PHYSICAL_EDUCATION = 'физкультура',
    OTHER = 'другое',
}

// ==================== Working Days Helpers ====================

/** Битовая маска дней недели: 1=Пн, 2=Вт, 4=Ср, 8=Чт, 16=Пт, 32=Сб */
export const WORKING_DAYS_5 = 31;  // Пн-Пт (1+2+4+8+16)
export const WORKING_DAYS_6 = 63;  // Пн-Сб (1+2+4+8+16+32)

/** Проверить, является ли день рабочим по битовой маске */
export function isDayWorking(workingDays: number, dayOfWeek: number): boolean {
    return (workingDays & (1 << (dayOfWeek - 1))) !== 0;
}

/** Получить список рабочих дней из битовой маски */
export function getWorkingDaysList(workingDays: number): number[] {
    const days: number[] = [];
    for (let d = 1; d <= 7; d++) {
        if (isDayWorking(workingDays, d)) days.push(d);
    }
    return days;
}

// ==================== Interfaces ====================

export interface SchoolClass {
    id: number;
    schoolId: number;
    name: string;
    gradeLevel: number;
    studentsCount: number;
    maxLessonsPerDay?: number;
    classroomId?: number;
    color: string;
    isActive: boolean;
    shift?: number; // 1 = первая смена, 2 = вторая смена (null = единое время)
    groups?: ClassGroup[];
    createdAt: string;
    updatedAt: string;
}

export interface ClassGroup {
    id: number;
    classId: number;
    name: string;
    studentsCount?: number;
    sortOrder: number;
}

export interface Teacher {
    id: number;
    schoolId: number;
    fullName: string;
    shortName: string;
    email?: string;
    phone?: string;
    color: string;
    maxLessonsPerDay: number;
    maxWindowsPerDay: number;
    isActive: boolean;
    subjects?: Subject[];
    preferredRooms?: Room[];
    availability?: TeacherAvailability[];
    createdAt: string;
    updatedAt: string;
}

export interface TeacherAvailability {
    id: number;
    teacherId: number;
    dayOfWeek: number;
    lessonNumber: number;
    isAvailable: boolean;
    preference: number; // -2 to +2
    reason?: string;
}

export interface Subject {
    id: number;
    schoolId: number;
    name: string;
    shortName: string;
    color: string;
    sanpinCategory: SanpinCategory;
    difficulty: number;
    requiresSpecialRoom: boolean;
    isActive: boolean;
    allowedRooms?: Room[];
    createdAt: string;
    updatedAt: string;
}

export interface Room {
    id: number;
    schoolId: number;
    name: string;
    capacity: number;
    floor?: number;
    type: RoomType;
    equipment?: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LessonType {
    id: number;
    schoolId: number;
    name: string;
    shortName: string;
    color: string;
    showInPrint: boolean;
    sortOrder: number;
}

export interface ScheduleVersion {
    id: number;
    schoolId: number;
    name: string;
    type: ScheduleVersionType;
    weekType: WeekType;
    status: ScheduleStatus;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
    workingDays: number;
    maxLessonsPerDay: number;
    copiedFromId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface BellSchedule {
    id: number;
    versionId: number;
    lessonNumber: number;
    startTime: string;
    endTime: string;
    breakAfter: number;
    shift?: number; // 1 = первая смена, 2 = вторая смена (null = единое)
    name?: string;
}

export interface Workload {
    id: number;
    versionId: number;
    classId: number;
    groupId?: number;
    subjectId: number;
    teacherId: number;
    roomId?: number;
    lessonTypeId?: number;
    hoursPerWeek: number;
    weekType: WorkloadWeekType;
    difficulty?: number;
    allowDoubleLessons?: boolean;
    additionalClassIds?: number[];
    additionalTeacherIds?: number[];
    notes?: string;
    // Связанные объекты (для отображения)
    schoolClass?: SchoolClass;
    group?: ClassGroup;
    subject?: Subject;
    teacher?: Teacher;
    room?: Room;
    lessonType?: LessonType;
    // Вычисляемые поля
    placedHours?: number;
    remainingHours?: number;
}

export interface ScheduleLesson {
    id: number;
    versionId: number;
    workloadId: number;
    dayOfWeek: number;
    lessonNumber: number;
    weekType: WorkloadWeekType;
    roomId?: number;
    isLocked: boolean;
    // Связанные объекты (денормализованные для отображения)
    workload?: Workload;
    room?: Room;
    schoolClass?: SchoolClass;
    group?: ClassGroup;
    subject?: Subject;
    teacher?: Teacher;
    createdAt: string;
    updatedAt: string;
}

export interface Substitution {
    id: number;
    lessonId: number;
    date: string;
    newTeacherId?: number;
    newRoomId?: number;
    newSubjectId?: number;
    newDayOfWeek?: number;
    newLessonNumber?: number;
    newWeekType?: string;
    isCancelled: boolean;
    reason?: string;
    createdBy: string;
    createdAt: string;
    // Связанные объекты
    lesson?: ScheduleLesson;
    newTeacher?: Teacher;
    newRoom?: Room;
    newSubject?: Subject;
}

export interface ScheduleConflict {
    id: number;
    versionId: number;
    type: ConflictType;
    category: ConflictCategory;
    description: string;
    affectedLessons?: number[];
    affectedObjects?: {
        teacherIds?: number[];
        classIds?: number[];
        roomIds?: number[];
        workloadIds?: number[];
    };
    sanpinReference?: string;
    severity: number;
    dayOfWeek?: number;
    lessonNumber?: number;
    isResolved: boolean;
    createdAt: string;
}

// ==================== API Response Types ====================

export interface ScheduleVersionResponse {
    version: ScheduleVersion;
    bellSchedule: BellSchedule[];
    workloads: Workload[];
    lessons: ScheduleLesson[];
    conflicts: ScheduleConflict[];
}

export interface LessonActionResult {
    success: boolean;
    lesson?: ScheduleLesson;
    errors?: {
        type: ConflictType;
        reason: string;
        conflictingLesson?: ScheduleLesson;
    }[];
    warnings?: {
        type: ConflictType;
        reason: string;
    }[];
    conflicts?: ScheduleConflict[];
    resolvedConflicts?: number[];
}

export interface PlacementCheckResult {
    canPlace: boolean;
    conflicts: {
        type: ConflictType;
        reason: string;
        conflictingLesson?: ScheduleLesson;
    }[];
    suggestions?: {
        dayOfWeek: number;
        lessonNumber: number;
        weekType: WorkloadWeekType;
        quality: number;
    }[];
}

export interface AutoGenerateOptions {
    mode: 'full' | 'fill_gaps' | 'optimize';
    respectLocked?: boolean;
    maxIterations?: number;
    timeout?: number;
    priorities?: {
        minimizeWindows: number;
        teacherPreferences: number;
        roomPreferences: number;
        evenDistribution: number;
    };
}

export interface AutoGenerateResult {
    status: 'completed' | 'partial' | 'failed';
    placedLessons: number;
    unplacedWorkloads?: Workload[];
    conflicts: ScheduleConflict[];
    statistics: {
        totalWorkloads: number;
        placedWorkloads: number;
        hardViolations: number;
        softViolations: number;
        totalPenalty: number;
        executionTimeMs: number;
    };
}

export interface ValidationResult {
    isValid: boolean;
    hardConstraintViolations: {
        rule: string;
        description: string;
        affectedObjects: string[];
        sanpinReference?: string;
    }[];
    softConstraintViolations: {
        rule: string;
        description: string;
        penalty: number;
    }[];
    statistics: {
        totalLessons: number;
        placedLessons: number;
        unplacedWorkload: number;
        teacherWindows: number;
        classWindows: number;
    };
}

export interface ScheduleStatistics {
    totalLessons: number;
    placedLessons: number;
    unplacedWorkload: number;
    teacherWindows: number;
    classWindows: number;
    hardConflicts: number;
    softConflicts: number;
    byClass: {
        classId: number;
        name: string;
        lessons: number;
        conflicts: number;
    }[];
    byTeacher: {
        teacherId: number;
        name: string;
        lessons: number;
        windows: number;
    }[];
}

// ==================== UI Types ====================

export type ViewMode = 'class' | 'teacher' | 'room';

export interface TimeSlot {
    dayOfWeek: number;
    lessonNumber: number;
    weekType: WorkloadWeekType;
}

export interface DragItem {
    type: 'LESSON' | 'WORKLOAD';
    id: number;
    workloadId?: number;
}

export const DAYS_OF_WEEK = [
    { num: 1, name: 'Понедельник', short: 'Пн' },
    { num: 2, name: 'Вторник', short: 'Вт' },
    { num: 3, name: 'Среда', short: 'Ср' },
    { num: 4, name: 'Четверг', short: 'Чт' },
    { num: 5, name: 'Пятница', short: 'Пт' },
    { num: 6, name: 'Суббота', short: 'Сб' },
    { num: 7, name: 'Воскресенье', short: 'Вс' },
];

export const CONFLICT_LABELS: Record<ConflictCategory, string> = {
    [ConflictCategory.TEACHER_CONFLICT]: 'Конфликт учителя',
    [ConflictCategory.CLASS_CONFLICT]: 'Конфликт класса',
    [ConflictCategory.ROOM_CONFLICT]: 'Конфликт кабинета',
    [ConflictCategory.ROOM_CAPACITY]: 'Недостаточная вместимость',
    [ConflictCategory.SANPIN_MAX_LESSONS]: 'Превышение нормы уроков',
    [ConflictCategory.SANPIN_MAX_DIFFICULTY]: 'Превышение сложности',
    [ConflictCategory.SANPIN_SUBJECT_PLACEMENT]: 'Неоптимальное размещение',
    [ConflictCategory.TEACHER_UNAVAILABLE]: 'Учитель недоступен',
    [ConflictCategory.TEACHER_WINDOW]: 'Окно у учителя',
    [ConflictCategory.CLASS_WINDOW]: 'Окно у класса',
    [ConflictCategory.UNEVEN_DISTRIBUTION]: 'Неравномерная нагрузка',
    [ConflictCategory.WORKLOAD_NOT_PLACED]: 'Нагрузка не размещена',
};
