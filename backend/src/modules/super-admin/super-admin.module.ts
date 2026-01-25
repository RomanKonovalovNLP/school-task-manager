import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAdmin } from './entities/super-admin.entity';
import { School } from '../schools/entities/school.entity';
import { Admin } from '../admins/entities/admin.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([SuperAdmin, School, Admin]),
    ],
    controllers: [SuperAdminController],
    providers: [SuperAdminService],
    exports: [SuperAdminService],
})
export class SuperAdminModule {}
