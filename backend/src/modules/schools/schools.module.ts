import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([School, Admin])],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [TypeOrmModule],
})
export class SchoolsModule { }