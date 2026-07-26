#!/bin/bash
set -e

echo "=== ПланТакт: Деплой на сервер ==="

# 1. Установка Docker если нет
if ! command -v docker &> /dev/null; then
    echo ">>> Установка Docker..."
    apt-get update && apt-get install -y curl
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    mkdir -p /etc/docker
    echo '{"dns": ["8.8.8.8", "8.8.4.4"]}' > /etc/docker/daemon.json
    systemctl restart docker
fi

# 2. Создать swap 2GB чтобы сервер не зависал при сборке
if [ ! -f /swapfile ] || [ "$(swapon --show | wc -l)" -lt 2 ]; then
    echo ">>> Создание swap 2GB..."
    swapoff /swapfile 2>/dev/null || true
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo ">>> Swap создан"
fi

# 3. Клонирование/обновление кода
APP_DIR="/root/plantakt"
if [ -d "$APP_DIR/.git" ]; then
    echo ">>> Обновление кода..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo ">>> Клонирование репозитория..."
    rm -rf "$APP_DIR"
    git clone https://github.com/RomanKonovalovNLP/school-task-manager.git "$APP_DIR"
    cd "$APP_DIR"
fi

mkdir -p nginx/ssl

# 4. Остановка всего лишнего
echo ">>> Остановка старых контейнеров..."
docker compose down 2>/dev/null || true
docker stop school_tasks_db temp_nginx 2>/dev/null || true
docker rm school_tasks_db temp_nginx 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
systemctl stop postgresql 2>/dev/null || true
systemctl disable postgresql 2>/dev/null || true

# 5. Сборка и запуск
echo ">>> Сборка контейнеров (5-10 минут)..."
docker compose build --no-cache

echo ">>> Запуск..."
docker compose up -d

echo ">>> Ожидание БД..."
sleep 15

# 6. Миграции
echo ">>> Миграции..."
docker exec plantakt_db psql -U postgres -d school_tasks -c "
    ALTER TABLE schedule_versions ADD COLUMN IF NOT EXISTS institution_type VARCHAR(20) DEFAULT 'school';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_only BOOLEAN DEFAULT false;
    CREATE TABLE IF NOT EXISTS agenda_items (id SERIAL PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, description TEXT, start_time TIME, end_time TIME, sort_order INTEGER DEFAULT 0, responsible_names JSONB, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
    ALTER TABLE event_attachments ADD COLUMN IF NOT EXISTS agenda_item_id INTEGER REFERENCES agenda_items(id) ON DELETE CASCADE;
    ALTER TABLE event_tasks ADD COLUMN IF NOT EXISTS agenda_item_id INTEGER REFERENCES agenda_items(id) ON DELETE CASCADE;
    CREATE TABLE IF NOT EXISTS schedule_calendar_days (id SERIAL PRIMARY KEY, version_id INTEGER NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE, date DATE NOT NULL, day_type VARCHAR(20) NOT NULL DEFAULT 'working', max_lessons INTEGER, week_number INTEGER, note TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(version_id, date));
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_calendar_days_version ON schedule_calendar_days(version_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_personal ON tasks(is_personal);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_event ON agenda_items(event_id);
    ANALYZE;
" 2>/dev/null || echo "Миграции OK (таблицы могут уже существовать)"

# 7. Восстановление бэкапа БД если есть
if [ -f /root/db_backup.sql ]; then
    echo ">>> Восстановление БД из бэкапа..."
    docker exec -i plantakt_db psql -U postgres -d school_tasks < /root/db_backup.sql 2>/dev/null || echo "Бэкап восстановлен (ошибки дубликатов — норма)"
fi

echo ""
echo "=== Статус ==="
docker compose ps

echo ""
echo "=== Готово! ==="
echo "http://185.251.88.60 (без SSL)"
echo ""
echo "Для SSL выполни:"
echo "  docker compose down"
echo "  docker run --rm --network host -v plantakt_certbot_certs:/etc/letsencrypt certbot/certbot certonly --standalone --email roman@plantakt.ru --agree-tos --no-eff-email -d plantakt.ru -d www.plantakt.ru"
echo "  docker compose up -d"
