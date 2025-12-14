import { Test, TestingModule } from '@nestjs/testing';
import { TaskPositionsController } from './task-positions.controller';

describe('TaskPositionsController', () => {
  let controller: TaskPositionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskPositionsController],
    }).compile();

    controller = module.get<TaskPositionsController>(TaskPositionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
