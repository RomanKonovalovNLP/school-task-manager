import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { School } from '../schools/entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';
import { UserSession } from './entities/user-session.entity';
import { SchoolAuthGuard } from '../../common/guards/school-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([School, Admin, UserSession])],
  controllers: [AuthController],
  providers: [AuthService, SchoolAuthGuard, AdminGuard],
  exports: [TypeOrmModule, SchoolAuthGuard, AdminGuard],
})
export class AuthModule { }