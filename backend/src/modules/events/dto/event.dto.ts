import { IsString, IsNotEmpty, IsDateString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    // ✅ НОВОЕ: Дата и время начала (обязательно)
    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    // ✅ НОВОЕ: Дата и время окончания (опционально)
    @IsDateString()
    @IsOptional()
    endDate?: string;

    // ✅ НОВОЕ: Флаг "весь день"
    @IsBoolean()
    @IsOptional()
    allDay?: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsNotEmpty()
    assigneeCategories: string[];

    // Для обратной совместимости
    @IsDateString()
    @IsOptional()
    eventDate?: string;
}

export class UpdateEventDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    // ✅ НОВОЕ: Дата и время начала
    @IsDateString()
    @IsOptional()
    startDate?: string;

    // ✅ НОВОЕ: Дата и время окончания
    @IsDateString()
    @IsOptional()
    endDate?: string;

    // ✅ НОВОЕ: Флаг "весь день"
    @IsBoolean()
    @IsOptional()
    allDay?: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assigneeCategories?: string[];

    // Для обратной совместимости
    @IsDateString()
    @IsOptional()
    eventDate?: string;
}

export class CreateEventTaskDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    deadline?: string;
}

export class UpdateEventTaskDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    deadline?: string;
}
