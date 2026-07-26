import { IsOptional, IsString, IsEnum, IsBooleanString } from 'class-validator';

export enum TaskPriority {
    URGENT = 'urgent',
    MEDIUM = 'medium',
    LOW = 'low',
    OVERDUE = 'overdue',
}

export class TaskFilterDto {
    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    priority?: string; // urgent | medium | low | overdue | important

    @IsOptional()
    @IsString()
    creatorName?: string;

    // FIX #2, #3: Фильтры по типу задач
    @IsOptional()
    @IsBooleanString()
    showShared?: string; // 'true' | 'false' (query params всегда строки)

    @IsOptional()
    @IsBooleanString()
    showPersonal?: string;
}
