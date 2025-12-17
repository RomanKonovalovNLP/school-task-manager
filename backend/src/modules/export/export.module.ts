import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { Task } from '../tasks/entities/task.entity';
import { UserSession } from '../auth/entities/user-session.entity';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
    imports: [TypeOrmModule.forFeature([Task, UserSession]), StatisticsModule],
    controllers: [ExportController],
    providers: [ExportService],
    exports: [ExportService],
})
export class ExportModule {}
