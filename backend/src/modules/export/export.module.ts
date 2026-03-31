import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { Task } from '../tasks/entities/task.entity';
import { UserSession } from '../auth/entities/user-session.entity';
import { StatisticsModule } from '../statistics/statistics.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Task, UserSession]),
        StatisticsModule,
        AuthModule, // D6: Явный импорт для SchoolAuthGuard
    ],
    controllers: [ExportController],
    providers: [ExportService],
    exports: [ExportService],
})
export class ExportModule {}
