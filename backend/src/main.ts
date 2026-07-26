import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ValidationPipe } from '@nestjs/common';
import { Client, types as pgTypes } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

// ⏰ ИСПРАВЛЕНИЕ ЧАСОВЫХ ПОЯСОВ
// Работаем в UTC внутри процесса, чтобы время не «уезжало» на часовой пояс сервера.
process.env.TZ = 'UTC';

// Колонки типа `timestamp without time zone` (создавались как TIMESTAMP DEFAULT NOW())
// драйвер pg по умолчанию интерпретирует как локальное время процесса Node.
// Если сервер запущен не в UTC, время в уведомлениях/задачах сдвигается на несколько
// часов. Заставляем pg трактовать такие значения как UTC — тогда всем пользователям
// показывается корректное абсолютное время (OID 1114 = timestamp without time zone).
pgTypes.setTypeParser(1114, (value: string) =>
  value === null ? null : new Date(value.replace(' ', 'T') + 'Z'),
);

/**
 * Читает переменные БД из .env (Nest ещё не инициализирован на этом этапе).
 */
function readDbEnv(): Record<string, string> {
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
    // .env может отсутствовать — используем process.env
  }
  return env;
}

/**
 * Идемпотентная конвертация всех колонок timestamp -> timestamptz на месте,
 * БЕЗ потери данных (существующие значения трактуются как UTC).
 *
 * Нужна потому, что TypeORM synchronize:true не может сам изменить тип
 * заполненной NOT NULL колонки (пытается пересоздать её и падает на NULL).
 * Выполняется ДО инициализации Nest/TypeORM, поэтому synchronize уже видит
 * совпадающую схему и не трогает эти колонки. В production не запускается
 * (там схема управляется миграциями).
 */
async function ensureTimestamptzColumns(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const env = readDbEnv();
  const client = new Client({
    host: env.DATABASE_HOST || 'localhost',
    port: Number(env.DATABASE_PORT) || 5432,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
  });

  try {
    await client.connect();
    await client.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type = 'timestamp without time zone'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
          );
        END LOOP;
      END $$;
    `);
    console.log('✅ Колонки timestamp приведены к timestamptz (если требовалось)');
  } catch (e: any) {
    console.warn('⚠ Конвертация timestamptz пропущена:', e?.message || e);
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

async function ensureUserApprovals(app: any): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const ds = app.get(DataSource);
    // Грандфазер: все, у кого уже есть сессия, считаются подтверждёнными
    await ds.query(`
      INSERT INTO user_profiles (school_id, full_name, approved, created_at, updated_at)
      SELECT DISTINCT s.school_id, s.full_name, true, NOW(), NOW()
      FROM user_sessions s
      WHERE NOT EXISTS (
        SELECT 1 FROM user_profiles p WHERE p.school_id = s.school_id AND p.full_name = s.full_name
      )
    `);
    console.log('✅ Существующие пользователи (по сессиям) отмечены подтверждёнными');
  } catch (e: any) {
    console.warn('⚠ Бэкофилл подтверждений входа пропущен:', e?.message || e);
  }
}

async function bootstrap() {
  // Готовим схему до инициализации TypeORM (synchronize)
  await ensureTimestamptzColumns();

  const app = await NestFactory.create(AppModule);
  await ensureUserApprovals(app);

  // Глобальный фильтр исключений
  app.useGlobalFilters(new AllExceptionsFilter());

  // Глобальная валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Убирает поля, которых нет в DTO
      forbidNonWhitelisted: true, // Выбрасывает ошибку при лишних полях
      transform: true, // Автоматически преобразует типы
    }),
  );

  // CORS для frontend
  // FIX #1: exposedHeaders позволяет браузеру читать Content-Disposition
  // Без этого заголовок недоступен фронтенду и имена файлов падают на fallback
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Backend запущен на http://localhost:${port}`);
  console.log(`📊 База данных: ${process.env.DATABASE_NAME}`);
}
bootstrap();
