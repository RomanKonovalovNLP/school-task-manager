import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskView } from './entities/task-view.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskGroup } from './entities/task-group.entity';
import { TaskGroupItem } from './entities/task-group-item.entity';
import { TaskFocus } from './entities/task-focus.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Task,
            TaskAssignee,
            TaskView,
            TaskCompletion,
            TaskAttachment,
            TaskGroup,
            TaskGroupItem,
            TaskFocus,
            UserProfile,
            UserCategory,
        ]),
        MulterModule.register({
            storage: memoryStorage(),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10 MB
            },
        }),
        NotificationsModule,
        AuthModule,  // Добавлено для SchoolAuthGuard
    ],
    controllers: [TasksController],
    providers: [TasksService],
    exports: [TasksService],
})
export class TasksModule {}
