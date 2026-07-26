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
import { TeachersService } from '../services/teachers.service';
import { CreateTeacherDto } from '../dto/schedule.dto';

@Controller('schedule/teachers')
@UseGuards(SchoolAuthGuard)
export class TeachersController {
    constructor(private teachersService: TeachersService) {}

    @Get()
    async findAll(@Request() req) {
        const teachers = await this.teachersService.findAll(req.user.schoolId);
        return { teachers };
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.teachersService.findOne(id, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Post()
    async create(@Body() dto: CreateTeacherDto, @Request() req) {
        return this.teachersService.create(dto, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateTeacherDto>,
        @Request() req,
    ) {
        return this.teachersService.update(id, dto, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.teachersService.remove(id, req.user.schoolId);
    }

    @Get(':id/availability')
    async getAvailability(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.teachersService.getAvailability(id, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Post(':id/availability')
    async setAvailability(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { dayOfWeek: number; lessonNumber: number; isAvailable: boolean; preference?: number },
        @Request() req,
    ) {
        return this.teachersService.setAvailability(
            id,
            body.dayOfWeek,
            body.lessonNumber,
            body.isAvailable,
            body.preference,
            req.user.schoolId,
        );
    }
}
