import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskPositionsController } from './task-positions.controller';
import { TaskPositionsService } from './task-positions.service';
import { TaskPosition } from './entities/task-position.entity';
import { TaskGroup } from './entities/task-group.entity';
import { Task } from '../tasks/entities/task.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskPosition, TaskGroup, Task]),
    AuthModule,
  ],
  controllers: [TaskPositionsController],
  providers: [TaskPositionsService],
  exports: [TypeOrmModule, TaskPositionsService],
})
export class TaskPositionsModule { }