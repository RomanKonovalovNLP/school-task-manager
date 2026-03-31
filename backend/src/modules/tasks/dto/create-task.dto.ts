import {
    IsString,
    IsNotEmpty,
    IsDateString,
    IsArray,
    ArrayMinSize,
    MaxLength,
    IsBoolean,
    IsOptional,
} from 'class-validator';

export class CreateTaskDto {
    @IsString()
    @IsNotEmpty({ message: 'Название задачи обязательно' })
    @MaxLength(255, { message: 'Название не должно превышать 255 символов' })
    title: string;

    @IsString()
    description: string;

    @IsDateString({}, { message: 'Неверный формат даты дедлайна' })
    deadline: string;

    @IsArray({ message: 'assigneeCategories должен быть массивом' })
    @IsString({ each: true, message: 'Каждая категория должна быть строкой' })
    assigneeCategories: string[];

    // FIX #2: Личная задача
    @IsBoolean()
    @IsOptional()
    isPersonal?: boolean;

    // FIX #2: Видна только назначенным категориям
    @IsBoolean()
    @IsOptional()
    categoryOnly?: boolean;
}
