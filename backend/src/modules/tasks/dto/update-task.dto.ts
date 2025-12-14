import {
    IsString,
    IsOptional,
    IsDateString,
    IsArray,
    MaxLength,
} from 'class-validator';

export class UpdateTaskDto {
    @IsString()
    @IsOptional()
    @MaxLength(255)
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    deadline?: string;

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    assigneeCategories?: string[];
}