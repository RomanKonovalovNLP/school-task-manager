import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsNotEmpty({ message: 'ФИО обязательно для заполнения' })
    fullName: string;

    @IsString()
    @IsNotEmpty({ message: 'Пароль школы обязателен' })
    @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
    schoolPassword: string;
}