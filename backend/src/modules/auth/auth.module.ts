import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { School } from '../schools/entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';
import { UserSession } from './entities/user-session.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserCategory } from '../filters/entities/user-category.entity';
import { FilterCategory } from '../filters/entities/filter-category.entity';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      School,
      Admin,
      UserSession,
      UserProfile,
      UserCategory,
      FilterCategory,
    ])
  ],
  controllers: [AuthController],
  providers: [AuthService, SchoolAuthGuard, AdminGuard],
  exports: [TypeOrmModule, SchoolAuthGuard, AdminGuard, AuthService],
})
export class AuthModule { }
