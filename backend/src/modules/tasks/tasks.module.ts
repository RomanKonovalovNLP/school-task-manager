import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskView } from './entities/task-view.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskAssignee, TaskView]),
    AuthModule, // Для Guard'ов
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TypeOrmModule, TasksService],
})
export class TasksModule { }
