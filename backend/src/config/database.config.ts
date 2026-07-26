import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const getDatabaseConfig = (
    configService: ConfigService,
): TypeOrmModuleOptions => {
    const isProduction = configService.get('NODE_ENV') === 'production';

    return {
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USER'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        autoLoadEntities: true,

        // Миграции лежат рядом с исходниками и попадают в сборку
        migrations: [path.join(__dirname, '/../migrations/*{.ts,.js}')],
        migrationsTableName: 'migrations',

        // В production схему меняют ТОЛЬКО миграции: автосинхронизация может
        // молча удалить колонку или таблицу вместе с данными.
        synchronize: !isProduction,

        // Непринятые миграции применяются при старте, чтобы деплой
        // не требовал ручного шага и схема не отставала от кода.
        migrationsRun: isProduction,

        // В production полный лог запросов быстро забивает диск —
        // оставляем только ошибки, предупреждения и миграции
        logging: isProduction ? ['error', 'warn', 'migration'] : true,
    };
};
