import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SchoolsModule } from './modules/schools/schools.module';
import { AdminsModule } from './modules/admins/admins.module';
import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TaskPositionsModule } from './modules/task-positions/task-positions.module';
import { FiltersModule } from './modules/filters/filters.module';
import { NotificationsModule } from './modules/notifications/notifications.module';


@Module({
  imports: [
    // Глобальная конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Подключение к PostgreSQL
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Планировщик задач
    ScheduleModule.forRoot(),

    SchoolsModule,
    AdminsModule,
    AuthModule,
    TasksModule,
    TaskPositionsModule,
    FiltersModule,
    NotificationsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
