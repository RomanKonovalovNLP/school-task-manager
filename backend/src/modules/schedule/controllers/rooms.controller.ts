import {
    Controller,
    Get,
    Post,
    Put,
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
import { RoomsService } from '../services/rooms.service';
import { CreateRoomDto } from '../dto/schedule.dto';

@Controller('schedule/rooms')
@UseGuards(SchoolAuthGuard)
export class RoomsController {
    constructor(private roomsService: RoomsService) {}

    @Get()
    async findAll(@Request() req) {
        const rooms = await this.roomsService.findAll(req.user.schoolId);
        return { rooms };
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.roomsService.findOne(id, req.user.schoolId);
    }

    @Post()
    async create(@Body() dto: CreateRoomDto, @Request() req) {
        return this.roomsService.create(dto, req.user.schoolId);
    }

    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: Partial<CreateRoomDto>,
        @Request() req,
    ) {
        return this.roomsService.update(id, dto, req.user.schoolId);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        await this.roomsService.remove(id, req.user.schoolId);
    }
}
