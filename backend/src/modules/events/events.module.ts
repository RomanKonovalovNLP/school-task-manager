import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { EventAssignee } from './entities/event-assignee.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { EventTask } from './entities/event-task.entity';
import { EventTaskCompletion } from './entities/event-task-completion.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module'; // ✅ НОВОЕ

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Event,
            EventAssignee,
            EventAttachment,
            EventTask,
            EventTaskCompletion,
            UserProfile,
        ]),
        MulterModule.register({
            limits: {
                fileSize: 10 * 1024 * 1024, // 10 MB
            },
        }),
        AuthModule,
        NotificationsModule, // ✅ НОВОЕ: Добавляем для уведомлений о мероприятиях
    ],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService],
})
export class EventsModule {}
