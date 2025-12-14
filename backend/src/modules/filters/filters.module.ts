import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';
import { FilterCategory } from './entities/filter-category.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([FilterCategory]), AuthModule],
  controllers: [FiltersController],
  providers: [FiltersService],
  exports: [TypeOrmModule],
})
export class FiltersModule { }