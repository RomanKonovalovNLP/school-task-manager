import { Module } from '@nestjs/common';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';

@Module({
  providers: [FiltersService],
  controllers: [FiltersController]
})
export class FiltersModule {}
