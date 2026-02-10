import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { SchoolClass } from './entities/school-class.entity';
import { ClassGroup } from './entities/class-group.entity';
import { Teacher } from './entities/teacher.entity';
import { Subject } from './entities/subject.entity';
import { Room } from './entities/room.entity';
import { LessonType } from './entities/lesson-type.entity';
import { ScheduleVersion } from './entities/schedule-version.entity';
import { Workload } from './entities/workload.entity';
import { ScheduleLesson } from './entities/schedule-lesson.entity';
import { Substitution } from './entities/substitution.entity';
import { BellSchedule } from './entities/bell-schedule.entity';
import { TeacherAvailability } from './entities/teacher-availability.entity';
import { ScheduleConflict } from './entities/schedule-conflict.entity';
import { SanpinRule } from './entities/sanpin-rule.entity';

// Controllers
import { ClassesController } from './controllers/classes.controller';
import { TeachersController } from './controllers/teachers.controller';
import { SubjectsController } from './controllers/subjects.controller';
import { RoomsController } from './controllers/rooms.controller';
import { ScheduleVersionsController } from './controllers/schedule-versions.controller';
import { WorkloadsController } from './controllers/workloads.controller';
import { LessonsController } from './controllers/lessons.controller';
import { SubstitutionsController } from './controllers/substitutions.controller';

// Services
import { ClassesService } from './services/classes.service';
import { TeachersService } from './services/teachers.service';
import { SubjectsService } from './services/subjects.service';
import { RoomsService } from './services/rooms.service';
import { ScheduleVersionsService } from './services/schedule-versions.service';
import { WorkloadsService } from './services/workloads.service';
import { LessonsService } from './services/lessons.service';
import { SubstitutionsService } from './services/substitutions.service';
import { ScheduleValidatorService } from './services/schedule-validator.service';
import { ScheduleExportService } from './services/schedule-export.service';

// Solver
import { ScheduleSolverService } from './solver/schedule-solver.service';
import { SanpinRulesService } from './solver/sanpin-rules.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SchoolClass,
            ClassGroup,
            Teacher,
            Subject,
            Room,
            LessonType,
            ScheduleVersion,
            Workload,
            ScheduleLesson,
            Substitution,
            BellSchedule,
            TeacherAvailability,
            ScheduleConflict,
            SanpinRule,
        ]),
    ],
    controllers: [
        ClassesController,
        TeachersController,
        SubjectsController,
        RoomsController,
        ScheduleVersionsController,
        WorkloadsController,
        LessonsController,
        SubstitutionsController,
    ],
    providers: [
        ClassesService,
        TeachersService,
        SubjectsService,
        RoomsService,
        ScheduleVersionsService,
        WorkloadsService,
        LessonsService,
        SubstitutionsService,
        ScheduleValidatorService,
        ScheduleExportService,
        ScheduleSolverService,
        SanpinRulesService,
    ],
    exports: [
        ClassesService,
        TeachersService,
        SubjectsService,
        RoomsService,
        ScheduleVersionsService,
        ScheduleSolverService,
    ],
})
export class ScheduleModule {}
