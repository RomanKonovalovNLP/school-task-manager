import {
    IsString,
    IsNotEmpty,
    IsDateString,
    IsArray,
    ArrayMinSize,
    MaxLength,
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
    @ArrayMinSize(1, { message: 'Необходимо выбрать хотя бы одну категорию' })
    @IsString({ each: true, message: 'Каждая категория должна быть строкой' })
    assigneeCategories: string[];
}