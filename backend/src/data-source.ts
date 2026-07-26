import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Отдельный источник данных для консоли TypeORM (генерация и применение миграций).
 *
 * Приложение использует конфигурацию из src/config/database.config.ts,
 * а CLI работает без Nest, поэтому переменные окружения читаем из .env сами.
 */
function loadEnv(): Record<string, string> {
    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    try {
        const raw = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
        for (const line of raw.split('\n')) {
            const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m && (env[m[1]] === undefined || env[m[1]] === '')) {
                env[m[1]] = m[2].replace(/\r$/, '').replace(/^["']|["']$/g, '');
            }
        }
    } catch {
        // .env может отсутствовать — тогда берём только process.env
    }
    return env;
}

const env = loadEnv();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: env.DATABASE_HOST || 'localhost',
    port: Number(env.DATABASE_PORT || 5432),
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,

    // Сущности и миграции ищем и в исходниках (ts-node), и в сборке (dist)
    entities: [path.join(__dirname, '/**/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],

    // Схемой управляют миграции, автосинхронизация здесь недопустима
    synchronize: false,
    logging: ['error', 'migration'],
});

export default AppDataSource;
