import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './entities/user-profile.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserCategory } from '../filters/entities/user-category.entity';
import { FilterCategory } from '../filters/entities/filter-category.entity';
import { Admin } from '../admins/entities/admin.entity';
import { Teacher } from '../schedule/entities/teacher.entity';
import { Workload } from '../schedule/entities/workload.entity';
import { ScheduleVersion } from '../schedule/entities/schedule-version.entity';
import { ScheduleLesson } from '../schedule/entities/schedule-lesson.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserProfile,
            UserCategory,
            FilterCategory,
            Admin,
            Teacher,
            Workload,
            ScheduleVersion,
            ScheduleLesson,
            Task,
            TaskCompletion,
        ]),
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [TypeOrmModule],
})
export class UsersModule {}
