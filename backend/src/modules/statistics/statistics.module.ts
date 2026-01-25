import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { TaskStatistic } from './entities/task-statistic.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { TaskAssignee } from '../tasks/entities/task-assignee.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TaskStatistic, Task, TaskCompletion, TaskAssignee]),
        AuthModule,
    ],
    controllers: [StatisticsController],
    providers: [StatisticsService],
    exports: [StatisticsService],
})
export class StatisticsModule {}
