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
import { SubjectsService } from '../services/subjects.service';
import { CreateSubjectDto } from '../dto/schedule.dto';

@Controller('schedule/subjects')
@UseGuards(SchoolAuthGuard)
export class SubjectsController {
    constructor(private subjectsService: SubjectsService) {}

    @Get()
    async findAll(@Request() req) {
        const subjects = await this.subjectsService.findAll(req.user.schoolId);
        return { subjects };
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.subjectsService.findOne(id, req.user.schoolId);
    }

    @Post()
    async create(@Body() dto: CreateSubjectDto, @Request() req) {
        return this.subjectsService.create(dto, req.user.schoolId);
    }

    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateSubjectDto>,
        @Request() req,
    ) {
        return this.subjectsService.update(id, dto, req.user.schoolId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.subjectsService.remove(id, req.user.schoolId);
    }
}
