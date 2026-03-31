import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';
import { FilterCategory } from './entities/filter-category.entity';
import { UserCategory } from './entities/user-category.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserSession } from '../auth/entities/user-session.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FilterCategory,
      UserCategory,
      UserProfile,
      UserSession,
    ]),
    AuthModule, // D6: Явный импорт для SchoolAuthGuard
  ],
  controllers: [FiltersController],
  providers: [FiltersService],
  exports: [FiltersService, TypeOrmModule],
})
export class FiltersModule { }
