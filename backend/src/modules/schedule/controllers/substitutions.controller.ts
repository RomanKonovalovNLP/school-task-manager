import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { SchoolAuthGuard } from '../../../common/guards/school-auth.guard';
import { SubstitutionsService } from '../services/substitutions.service';
import { CreateSubstitutionDto } from '../dto/schedule.dto';

@Controller('schedule/substitutions')
@UseGuards(SchoolAuthGuard)
export class SubstitutionsController {
    constructor(private substitutionsService: SubstitutionsService) {}

    @Get()
    async findByDate(@Query('date') date: string, @Request() req) {
        return this.substitutionsService.findByDate(date, req.user.schoolId);
    }

    @Post()
    async create(@Body() dto: CreateSubstitutionDto, @Request() req) {
        const createdBy = req.user.fullName || 'Admin';
        return this.substitutionsService.create(dto, createdBy, req.user.schoolId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.substitutionsService.remove(id, req.user.schoolId);
    }

    @Get('available-teachers')
    async getAvailableTeachers(
        @Query('lessonId', ParseIntPipe) lessonId: number,
        @Query('date') date: string,
        @Request() req,
    ) {
        return this.substitutionsService.getAvailableTeachers(lessonId, date, req.user.schoolId);
    }
}
