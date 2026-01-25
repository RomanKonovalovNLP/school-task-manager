import { IsString, MinLength, IsOptional, IsNumber, IsNotEmpty, Matches } from 'class-validator';

// ==================== SETUP ====================
export class SetupSuperAdminDto {
    @IsString()
    @IsNotEmpty()
    setupKey: string;

    @IsString()
    @MinLength(3)
    username: string;

    @IsString()
    @MinLength(12, { message: 'Пароль должен быть минимум 12 символов' })
    @Matches(/[A-Z]/, { message: 'Пароль должен содержать заглавные буквы' })
    @Matches(/[a-z]/, { message: 'Пароль должен содержать строчные буквы' })
    @Matches(/[0-9]/, { message: 'Пароль должен содержать цифры' })
    password: string;
}

// ==================== LOGIN ====================
export class LoginSuperAdminDto {
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

// Алиас для обратной совместимости
export { LoginSuperAdminDto as SuperAdminLoginDto };

// ==================== SCHOOLS ====================
export class CreateSchoolDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @MinLength(4)
    password: string;
}

export class UpdateSchoolDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    @MinLength(4)
    password?: string;
}

// ==================== ADMINS ====================
export class CreateSchoolAdminDto {
    @IsNumber()
    schoolId: number;

    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsString()
    @MinLength(4)
    password: string;
}

export class UpdateSchoolAdminDto {
    @IsString()
    @IsOptional()
    fullName?: string;

    @IsString()
    @IsOptional()
    @MinLength(4)
    password?: string;
}
