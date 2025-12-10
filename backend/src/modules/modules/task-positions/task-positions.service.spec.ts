import { Test, TestingModule } from '@nestjs/testing';
import { TaskPositionsService } from './task-positions.service';

describe('TaskPositionsService', () => {
  let service: TaskPositionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskPositionsService],
    }).compile();

    service = module.get<TaskPositionsService>(TaskPositionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
