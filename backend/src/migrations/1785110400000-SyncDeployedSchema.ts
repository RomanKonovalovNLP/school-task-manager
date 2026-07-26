import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Приводит схему боевой базы к текущему коду.
 *
 * Содержит всё, что появилось в приложении с версии, развёрнутой на сервере:
 * персональные назначения задач и мероприятий, личные уведомления, группы задач,
 * режим «Сегодня», подтверждение пользователей, повторяющиеся задачи и мероприятия,
 * перенос уроков в заменах.
 *
 * Все операции идемпотентны (IF NOT EXISTS / DROP NOT NULL), поэтому миграцию
 * безопасно применять к базе, где часть объектов уже создана.
 */
export class SyncDeployedSchema1785110400000 implements MigrationInterface {
    name = 'SyncDeployedSchema1785110400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---------- Задачи ----------
        await queryRunner.query(`
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS restrict_attachments boolean NOT NULL DEFAULT false;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence varchar(20);
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remind24_sent boolean NOT NULL DEFAULT false;
            ALTER TABLE tasks ADD COLUMN IF NOT EXISTS remind1_sent boolean NOT NULL DEFAULT false;
        `);

        // Персональные адресаты: строка назначения — либо категория, либо человек
        await queryRunner.query(`
            ALTER TABLE task_assignees ADD COLUMN IF NOT EXISTS assignee_user varchar(255);
            ALTER TABLE task_assignees ALTER COLUMN assignee_category DROP NOT NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS uploader_is_privileged boolean NOT NULL DEFAULT false;
        `);

        // ---------- Мероприятия ----------
        await queryRunner.query(`
            ALTER TABLE events ADD COLUMN IF NOT EXISTS location varchar(255);
            ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence varchar(20);
            ALTER TABLE event_assignees ADD COLUMN IF NOT EXISTS assignee_user varchar(255);
            ALTER TABLE event_assignees ALTER COLUMN assignee_category DROP NOT NULL;
        `);

        // ---------- Уведомления ----------
        // recipient_user — адресные уведомления; task_id/event_id стали необязательными
        // (недельная сводка и уведомление об удалённом мероприятии ни к чему не привязаны)
        await queryRunner.query(`
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_user varchar(255);
            ALTER TABLE notifications ALTER COLUMN recipient_category DROP NOT NULL;
            ALTER TABLE notifications ALTER COLUMN task_id DROP NOT NULL;
        `);

        // Персональный статус прочтения (раньше «прочитал один — пропало у всех»)
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS notification_reads (
                id SERIAL PRIMARY KEY,
                notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
                user_profile_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
                is_read BOOLEAN NOT NULL DEFAULT false,
                is_hidden BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_notification_reads UNIQUE (notification_id, user_profile_id)
            );
            CREATE INDEX IF NOT EXISTS idx_notification_reads_profile ON notification_reads(user_profile_id);
        `);

        // ---------- Пользователи ----------
        // approved = true для существующих: они уже работают, повторно подтверждать не нужно
        await queryRunner.query(`
            ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
        `);

        // ---------- Личные группы задач ----------
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS task_groups (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL,
                owner_name VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_task_groups_owner ON task_groups(school_id, owner_name);

            CREATE TABLE IF NOT EXISTS task_group_items (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                CONSTRAINT uq_task_group_items UNIQUE (group_id, task_id)
            );
        `);

        // ---------- Режим «Сегодня» ----------
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS task_focus (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL,
                owner_name VARCHAR(255) NOT NULL,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                focus_date DATE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_task_focus UNIQUE (school_id, owner_name, task_id, focus_date)
            );
            CREATE INDEX IF NOT EXISTS idx_task_focus_day ON task_focus(school_id, owner_name, focus_date);
        `);

        // ---------- Расписание: перенос урока в заменах ----------
        await queryRunner.query(`
            ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS new_day_of_week INTEGER;
            ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS new_lesson_number INTEGER;
            ALTER TABLE substitutions ADD COLUMN IF NOT EXISTS new_week_type VARCHAR(10);
            ALTER TABLE workloads ADD COLUMN IF NOT EXISTS allow_double_lessons boolean NOT NULL DEFAULT false;
        `);

        // ---------- Индексы под частые выборки ----------
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(assignee_user);
            CREATE INDEX IF NOT EXISTS idx_event_assignees_user ON event_assignees(assignee_user);
            CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON notifications(recipient_user);
        `);
    }

    /**
     * Откат намеренно ограничен: удаляются только новые таблицы и колонки,
     * данные в существующих таблицах не трогаются.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE IF EXISTS task_focus;
            DROP TABLE IF EXISTS task_group_items;
            DROP TABLE IF EXISTS task_groups;
            DROP TABLE IF EXISTS notification_reads;

            ALTER TABLE tasks DROP COLUMN IF EXISTS is_important;
            ALTER TABLE tasks DROP COLUMN IF EXISTS restrict_attachments;
            ALTER TABLE tasks DROP COLUMN IF EXISTS recurrence;
            ALTER TABLE tasks DROP COLUMN IF EXISTS remind24_sent;
            ALTER TABLE tasks DROP COLUMN IF EXISTS remind1_sent;
            ALTER TABLE task_assignees DROP COLUMN IF EXISTS assignee_user;
            ALTER TABLE task_attachments DROP COLUMN IF EXISTS uploader_is_privileged;
            ALTER TABLE events DROP COLUMN IF EXISTS location;
            ALTER TABLE events DROP COLUMN IF EXISTS recurrence;
            ALTER TABLE event_assignees DROP COLUMN IF EXISTS assignee_user;
            ALTER TABLE notifications DROP COLUMN IF EXISTS recipient_user;
            ALTER TABLE user_profiles DROP COLUMN IF EXISTS approved;
            ALTER TABLE substitutions DROP COLUMN IF EXISTS new_day_of_week;
            ALTER TABLE substitutions DROP COLUMN IF EXISTS new_lesson_number;
            ALTER TABLE substitutions DROP COLUMN IF EXISTS new_week_type;
            ALTER TABLE workloads DROP COLUMN IF EXISTS allow_double_lessons;
        `);
    }
}
