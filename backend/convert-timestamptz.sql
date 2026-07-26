-- Одноразовая конвертация всех колонок timestamp -> timestamptz БЕЗ потери данных.
-- Существующие значения хранились как UTC (Postgres по умолчанию в UTC),
-- поэтому интерпретируем их AT TIME ZONE 'UTC'.
--
-- Зачем: сущности переведены на timestamptz, а TypeORM synchronize:true
-- не может сам изменить тип заполненной NOT NULL колонки (пытается пересоздать
-- её и падает на NULL). После этого скрипта схема БД уже совпадает с сущностями,
-- и synchronize перестаёт трогать эти колонки.
--
-- Запуск (при ОСТАНОВЛЕННОМ backend), например:
--   psql -U postgres -d school_tasks -f backend/convert-timestamptz.sql
-- или выполнить содержимое в pgAdmin для базы school_tasks.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'
    LOOP
        RAISE NOTICE 'Convert %.% -> timestamptz', r.table_name, r.column_name;
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.table_name, r.column_name, r.column_name
        );
    END LOOP;
END $$;
