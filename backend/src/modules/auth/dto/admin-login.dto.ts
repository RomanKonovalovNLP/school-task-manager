import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AdminLoginDto {
    @IsString()
    @IsNotEmpty({ message: 'ФИО обязательно для заполнения' })
    fullName: string;

    @IsString()
    @IsNotEmpty({ message: 'Пароль администратора обязателен' })
    @MinLength(6, { message: 'Пароль администратора должен содержать минимум 6 символов' })
    adminPassword: string;

    @IsString()
    @IsNotEmpty({ message: 'Пароль школы обязателен' })
    @MinLength(6, { message: 'Пароль школы должен содержать минимум 6 символов' })
    schoolPassword: string;
}