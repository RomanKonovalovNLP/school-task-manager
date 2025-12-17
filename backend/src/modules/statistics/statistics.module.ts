import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { TaskStatistic } from './entities/task-statistic.entity';
import { Task } from '../tasks/entities/task.entity';
import { UserSession } from '../auth/entities/user-session.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TaskStatistic, Task, UserSession])],
    controllers: [StatisticsController],
    providers: [StatisticsService],
    exports: [StatisticsService],
})
export class StatisticsModule {}
