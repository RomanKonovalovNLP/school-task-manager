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
import { WorkloadsService } from '../services/workloads.service';
import { CreateWorkloadDto, UpdateWorkloadDto } from '../dto/schedule.dto';

@Controller('schedule/workloads')
@UseGuards(SchoolAuthGuard)
export class WorkloadsController {
    constructor(private workloadsService: WorkloadsService) {}

    @Get('version/:versionId')
    async findAll(@Param('versionId', ParseIntPipe) versionId: number, @Request() req) {
        const workloads = await this.workloadsService.findAll(versionId, req.user.schoolId);
        return { workloads };
    }

    @Get('version/:versionId/unplaced')
    async getUnplaced(@Param('versionId', ParseIntPipe) versionId: number, @Request() req) {
        const workloads = await this.workloadsService.getUnplaced(versionId, req.user.schoolId);
        return { workloads };
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.workloadsService.findOne(id, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Post('version/:versionId')
    async create(
        @Param('versionId', ParseIntPipe) versionId: number,
        @Body() dto: CreateWorkloadDto,
        @Request() req,
    ) {
        return this.workloadsService.create(versionId, dto, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateWorkloadDto,
        @Request() req,
    ) {
        return this.workloadsService.update(id, dto, req.user.schoolId);
    }

    @UseGuards(AdminGuard)
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.workloadsService.remove(id, req.user.schoolId);
    }
}
