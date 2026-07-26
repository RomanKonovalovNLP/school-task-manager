#!/bin/bash
#
# ПланТакт: развёртывание и обновление на сервере.
#
#   bash deploy.sh          — обновить код и перезапустить
#   bash deploy.sh --build  — то же, но с полной пересборкой образов
#
# Перед выкаткой скрипт ДЕЛАЕТ БЭКАП базы и вложений: если что-то пойдёт не так,
# есть куда откатиться. Схема базы обновляется миграциями автоматически
# (приложение применяет их при старте, подробности в DEPLOY.md).

set -euo pipefail

APP_DIR="${APP_DIR:-/root/plantakt}"
REPO_URL="https://github.com/RomanKonovalovNLP/school-task-manager.git"
BRANCH="${BRANCH:-main}"

echo "=== ПланТакт: деплой ==="

# ---------- 1. Docker ----------
if ! command -v docker &> /dev/null; then
    echo ">>> Устанавливаю Docker..."
    apt-get update && apt-get install -y curl
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
    mkdir -p /etc/docker
    echo '{"dns": ["8.8.8.8", "8.8.4.4"]}' > /etc/docker/daemon.json
    systemctl restart docker
fi

# ---------- 2. Swap (сборка фронтенда требует памяти) ----------
if [ ! -f /swapfile ]; then
    echo ">>> Создаю swap 2 ГБ..."
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------- 3. Код ----------
if [ -d "$APP_DIR/.git" ]; then
    echo ">>> Обновляю код..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    echo ">>> Клонирую репозиторий..."
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

mkdir -p nginx/ssl backups

# ---------- 4. Настройки ----------
# Секреты лежат в .env рядом с docker-compose.yml и в репозиторий не попадают.
if [ ! -f "$APP_DIR/.env" ]; then
    cat >&2 <<'MSG'

ОШИБКА: не найден файл .env с настройками.

Создайте /root/plantakt/.env примерно такого содержания:

  POSTGRES_USER=plantakt
  POSTGRES_PASSWORD=<длинный пароль>
  POSTGRES_DB=school_tasks
  SUPER_ADMIN_SETUP_KEY=<openssl rand -hex 32>
  FRONTEND_URL=https://plantakt.ru
  REACT_APP_API_URL=https://plantakt.ru/api

Затем запустите деплой ещё раз.
MSG
    exit 1
fi

# ---------- 5. Бэкап перед изменениями ----------
if docker ps --format '{{.Names}}' | grep -q '^plantakt_db$'; then
    echo ">>> Бэкап базы и вложений перед выкаткой..."
    STAMP="$(date +%Y-%m-%d_%H%M)"
    # shellcheck disable=SC1091
    set -a; . "$APP_DIR/.env"; set +a
    docker exec plantakt_db pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-school_tasks}" -Fc \
        > "backups/plantakt_db_${STAMP}.dump"
    docker run --rm -v plantakt_uploads:/data -v "$APP_DIR/backups:/backup" alpine \
        tar -czf "/backup/plantakt_files_${STAMP}.tar.gz" -C /data . 2>/dev/null || true
    echo "    сохранено: backups/plantakt_db_${STAMP}.dump"
    # Копии старше 14 дней удаляем
    find backups -name 'plantakt_*' -type f -mtime +14 -delete 2>/dev/null || true
else
    echo ">>> База ещё не запущена — бэкап пропускаю (первый запуск)"
fi

# ---------- 6. Сборка и запуск ----------
if [ "${1:-}" = "--build" ]; then
    echo ">>> Полная пересборка образов (5–10 минут)..."
    docker compose build --no-cache
else
    echo ">>> Сборка изменённых образов..."
    docker compose build
fi

echo ">>> Запуск..."
docker compose up -d

# ---------- 7. Проверка ----------
echo ">>> Жду готовности бэкенда..."
OK=0
for _ in $(seq 1 30); do
    if docker exec plantakt_backend node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))" 2>/dev/null; then
        OK=1; break
    fi
    sleep 3
done

echo
docker compose ps
echo
if [ "$OK" = "1" ]; then
    echo "=== Готово. Приложение отвечает. ==="
else
    echo "=== ВНИМАНИЕ: бэкенд не ответил за 90 секунд. Логи: ==="
    echo "  docker compose logs --tail=50 backend"
fi
echo
echo "Миграции применяются автоматически при старте бэкенда."
echo "Проверить: docker compose logs backend | grep -i migration"
