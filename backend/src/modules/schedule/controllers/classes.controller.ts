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
import { ClassesService } from '../services/classes.service';
import { CreateClassDto } from '../dto/schedule.dto';

@Controller('schedule/classes')
@UseGuards(SchoolAuthGuard)
export class ClassesController {
    constructor(private classesService: ClassesService) {}

    @Get()
    async findAll(@Request() req) {
        const classes = await this.classesService.findAll(req.user.schoolId);
        return { classes };
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.classesService.findOne(id, req.user.schoolId);
    }

    @Post()
    async create(@Body() dto: CreateClassDto, @Request() req) {
        return this.classesService.create(dto, req.user.schoolId);
    }

    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateClassDto>,
        @Request() req,
    ) {
        return this.classesService.update(id, dto, req.user.schoolId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.classesService.remove(id, req.user.schoolId);
    }

    @Post(':id/groups')
    async addGroup(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { name: string; studentsCount?: number },
        @Request() req,
    ) {
        return this.classesService.addGroup(id, body.name, body.studentsCount, req.user.schoolId);
    }

    @Delete('groups/:groupId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async removeGroup(
        @Param('groupId', ParseIntPipe) groupId: number,
    ) {
        await this.classesService.removeGroup(groupId);
    }
}
