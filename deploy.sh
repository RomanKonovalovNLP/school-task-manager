#!/bin/bash
set -e

echo "=== ПланТакт: Деплой на сервер ==="

# 1. Установка Docker если нет
if ! command -v docker &> /dev/null; then
    echo ">>> Установка Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo ">>> Установка Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 2. Клонирование/обновление кода
APP_DIR="/root/school-task-manager"
if [ -d "$APP_DIR" ]; then
    echo ">>> Обновление кода..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo ">>> Клонирование репозитория..."
    git clone https://github.com/RomanKonovalovNLP/school-task-manager.git "$APP_DIR"
    cd "$APP_DIR"
fi

# 3. Размещение Docker файлов
echo ">>> Размещение конфигурации..."

# docker-compose.yml в корень
# (уже должен быть в репозитории)

# Dockerfile для backend
cp backend/Dockerfile backend/Dockerfile 2>/dev/null || true

# Dockerfile для frontend
cp frontend/Dockerfile frontend/Dockerfile 2>/dev/null || true

# Nginx конфиг
mkdir -p nginx/ssl
# nginx.conf уже должен быть в репозитории

# 4. Получение SSL-сертификата
echo ">>> Настройка SSL..."

# Временный nginx без SSL для получения сертификата
cat > /tmp/nginx-temp.conf << 'NGINXEOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name plantakt.ru www.plantakt.ru;
        location /.well-known/acme-challenge/ { root /var/www/certbot; }
        location / { return 200 'OK'; add_header Content-Type text/plain; }
    }
}
NGINXEOF

# Проверяем, есть ли уже сертификат
if [ ! -f "/etc/letsencrypt/live/plantakt.ru/fullchain.pem" ] && [ ! -d "certbot_certs" ]; then
    echo ">>> Получаем SSL-сертификат..."

    # Запускаем временный nginx
    docker run -d --name temp_nginx \
        -p 80:80 \
        -v /tmp/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
        -v certbot_data:/var/www/certbot \
        nginx:alpine

    sleep 2

    # Получаем сертификат
    docker run --rm \
        -v certbot_data:/var/www/certbot \
        -v certbot_certs:/etc/letsencrypt \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email roman@plantakt.ru \
        --agree-tos \
        --no-eff-email \
        -d plantakt.ru \
        -d www.plantakt.ru

    # Останавливаем временный nginx
    docker stop temp_nginx && docker rm temp_nginx
    rm /tmp/nginx-temp.conf

    echo ">>> SSL-сертификат получен!"
else
    echo ">>> SSL-сертификат уже существует"
fi

# 5. Остановка старых контейнеров
echo ">>> Остановка старых контейнеров..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Останавливаем старый контейнер school_tasks_db если есть
docker stop school_tasks_db 2>/dev/null || true

# 6. Сборка и запуск
echo ">>> Сборка и запуск контейнеров..."
docker compose up -d --build 2>/dev/null || docker-compose up -d --build

# 7. Ждём пока БД поднимется
echo ">>> Ожидание БД..."
sleep 10

# 8. Миграции
echo ">>> Выполнение миграций..."
docker exec plantakt_db psql -U postgres -d school_tasks -c "
    ALTER TABLE schedule_versions ADD COLUMN IF NOT EXISTS institution_type VARCHAR(20) DEFAULT 'school';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_only BOOLEAN DEFAULT false;
    CREATE TABLE IF NOT EXISTS agenda_items (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL, description TEXT,
        start_time TIME, end_time TIME,
        sort_order INTEGER DEFAULT 0, responsible_names JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE event_attachments ADD COLUMN IF NOT EXISTS agenda_item_id INTEGER REFERENCES agenda_items(id) ON DELETE CASCADE;
    ALTER TABLE event_tasks ADD COLUMN IF NOT EXISTS agenda_item_id INTEGER REFERENCES agenda_items(id) ON DELETE CASCADE;
    CREATE TABLE IF NOT EXISTS schedule_calendar_days (
        id SERIAL PRIMARY KEY,
        version_id INTEGER NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
        date DATE NOT NULL, day_type VARCHAR(20) NOT NULL DEFAULT 'working',
        max_lessons INTEGER, week_number INTEGER, note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(version_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_calendar_days_version ON schedule_calendar_days(version_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_personal ON tasks(is_personal);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_event ON agenda_items(event_id);
    ANALYZE;
" 2>/dev/null || echo "Миграции: некоторые таблицы могут уже существовать (OK)"

# 9. Проверка
echo ""
echo "=== Статус контейнеров ==="
docker compose ps 2>/dev/null || docker-compose ps

echo ""
echo "=== Готово! ==="
echo "Сайт: https://plantakt.ru"
echo "Логин: https://plantakt.ru/login"
echo "Супер-админ: https://plantakt.ru/super-admin/login"
echo ""
echo "Полезные команды:"
echo "  docker compose logs -f          # Логи всех сервисов"
echo "  docker compose logs -f backend  # Логи бэкенда"
echo "  docker compose restart backend  # Перезапуск бэкенда"
echo "  docker compose down && docker compose up -d  # Полный перезапуск"
