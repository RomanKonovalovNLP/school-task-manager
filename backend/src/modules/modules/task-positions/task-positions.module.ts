import { Module } from '@nestjs/common';
import { TaskPositionsService } from './task-positions.service';
import { TaskPositionsController } from './task-positions.controller';

@Module({
  providers: [TaskPositionsService],
  controllers: [TaskPositionsController]
})
export class TaskPositionsModule {}
