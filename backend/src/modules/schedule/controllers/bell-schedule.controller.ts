import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { SchoolAuthGuard } from '../../../common/guards/school-auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { BellScheduleService } from '../services/bell-schedule.service';
import { CreateBellScheduleDto } from '../dto/schedule.dto';

@Controller('schedule/bell-schedules')
@UseGuards(SchoolAuthGuard)
export class BellScheduleController {
    constructor(private bellScheduleService: BellScheduleService) {}

    /**
     * Получить все звонки школы (глобальные, versionId = null)
     */
    @Get()
    async findAll(@Request() req) {
        const bellSchedules = await this.bellScheduleService.findAll(req.user.schoolId);
        return { bellSchedules };
    }

    /**
     * Создать звонок
     */
    @UseGuards(AdminGuard)
    @Post()
    async create(@Body() dto: CreateBellScheduleDto & { shift?: number }, @Request() req) {
        return this.bellScheduleService.create(dto, req.user.schoolId);
    }

    /**
     * Обновить звонок
     */
    @UseGuards(AdminGuard)
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateBellScheduleDto & { shift?: number }>,
        @Request() req,
    ) {
        return this.bellScheduleService.update(id, dto, req.user.schoolId);
    }

    /**
     * Удалить звонок
     */
    @UseGuards(AdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.bellScheduleService.remove(id, req.user.schoolId);
    }
}
