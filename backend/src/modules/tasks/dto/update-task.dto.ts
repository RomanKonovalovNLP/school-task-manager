import {
    IsString,
    IsOptional,
    IsDateString,
    IsArray,
    MaxLength,
    IsBoolean,
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

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    assigneeUsers?: string[];

    // FIX #2: Личная задача
    @IsBoolean()
    @IsOptional()
    isPersonal?: boolean;

    // FIX #2: Видна только назначенным категориям
    @IsBoolean()
    @IsOptional()
    categoryOnly?: boolean;

    // Ограничить видимость вложений от обычных пользователей
    @IsBoolean()
    @IsOptional()
    restrictAttachments?: boolean;

    @IsBoolean()
    @IsOptional()
    isImportant?: boolean;
}
