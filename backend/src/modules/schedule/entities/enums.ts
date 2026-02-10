// Общие enums для модуля расписания
// Вынесены в отдельный файл для избежания циклических зависимостей

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

export enum SanpinRuleType {
    MAX_LESSONS_PER_DAY = 'max_lessons_per_day',
    MAX_WEEKLY_HOURS = 'max_weekly_hours',
    MAX_DAILY_DIFFICULTY = 'max_daily_difficulty',
    SUBJECT_DIFFICULTY = 'subject_difficulty',
    SUBJECT_PLACEMENT = 'subject_placement',
    BREAK_DURATION = 'break_duration',
}
