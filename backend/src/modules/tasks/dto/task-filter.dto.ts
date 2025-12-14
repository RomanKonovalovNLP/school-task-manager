import { IsOptional, IsString, IsEnum } from 'class-validator';

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
    @IsEnum(TaskPriority)
    priority?: TaskPriority;

    @IsOptional()
    @IsString()
    creatorName?: string;
}