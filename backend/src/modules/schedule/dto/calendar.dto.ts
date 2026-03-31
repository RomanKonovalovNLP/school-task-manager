import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DayType } from '../entities/calendar-day.entity';

export class UpdateCalendarDayDto {
    @IsDateString()
    date: string;

    @IsEnum(DayType)
    dayType: DayType;

    @IsNumber()
    @IsOptional()
    maxLessons?: number;

    @IsString()
    @IsOptional()
    note?: string;
}

export class BulkUpdateCalendarDaysDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateCalendarDayDto)
    days: UpdateCalendarDayDto[];
}

export class GenerateCalendarDto {
    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;
}
