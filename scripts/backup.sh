#!/usr/bin/env bash
#
# Резервная копия ПланТакт: база данных + загруженные файлы.
#
# Запуск вручную:      bash scripts/backup.sh
# Запуск по расписанию: см. раздел «Бэкапы» в DEPLOY.md
#
# Копия состоит из двух файлов с одинаковой меткой времени:
#   plantakt_db_ГГГГ-ММ-ДД_ЧЧММ.dump      — база (формат custom, сжатый)
#   plantakt_files_ГГГГ-ММ-ДД_ЧЧММ.tar.gz — вложения задач и мероприятий
#
# Старые копии удаляются автоматически (см. KEEP_DAYS).

set -euo pipefail

# ---------- Настройки ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"

# Куда складывать копии. Лучше указать диск, отличный от того, где живёт база.
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

# Сколько дней хранить копии
KEEP_DAYS="${KEEP_DAYS:-14}"

# Папка с загруженными файлами
UPLOADS_DIR="${UPLOADS_DIR:-$BACKEND_DIR/uploads}"

# ---------- Чтение параметров подключения ----------
if [[ -f "$ENV_FILE" ]]; then
    # Берём только нужные переменные, не затирая уже заданные в окружении
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        value="${value%$'\r'}"
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        case "$key" in
            DATABASE_HOST|DATABASE_PORT|DATABASE_USER|DATABASE_PASSWORD|DATABASE_NAME)
                if [[ -z "${!key:-}" ]]; then export "$key=$value"; fi
                ;;
        esac
    done < <(grep -E '^[A-Za-z_]+=' "$ENV_FILE" || true)
fi

DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-postgres}"
DB_NAME="${DATABASE_NAME:-}"

if [[ -z "$DB_NAME" ]]; then
    echo "ОШИБКА: не задано имя базы (DATABASE_NAME). Проверьте $ENV_FILE" >&2
    exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "ОШИБКА: не найден pg_dump. Установите клиент PostgreSQL." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H%M)"
DB_FILE="$BACKUP_DIR/plantakt_db_${STAMP}.dump"
FILES_ARCHIVE="$BACKUP_DIR/plantakt_files_${STAMP}.tar.gz"

export PGPASSWORD="${DATABASE_PASSWORD:-}"

echo "[1/4] Копирую базу «$DB_NAME» -> $(basename "$DB_FILE")"
# Формат custom (-Fc) — сжатый и позволяет восстанавливать выборочно
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc -f "$DB_FILE"

echo "[2/4] Проверяю целостность копии"
# Если дамп повреждён, список объектов не прочитается — узнаем сразу, а не при восстановлении
if ! pg_restore --list "$DB_FILE" >/dev/null 2>&1; then
    echo "ОШИБКА: копия базы повреждена, удаляю $DB_FILE" >&2
    rm -f "$DB_FILE"
    exit 1
fi

echo "[3/4] Копирую вложения из $UPLOADS_DIR"
if [[ -d "$UPLOADS_DIR" ]]; then
    tar -czf "$FILES_ARCHIVE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
else
    echo "      папки с вложениями нет — пропускаю"
fi

echo "[4/4] Удаляю копии старше $KEEP_DAYS дней"
find "$BACKUP_DIR" -name 'plantakt_db_*.dump' -type f -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'plantakt_files_*.tar.gz' -type f -mtime "+$KEEP_DAYS" -delete

DB_SIZE="$(du -h "$DB_FILE" | cut -f1)"
echo
echo "Готово. База: $DB_SIZE, файл: $DB_FILE"
[[ -f "$FILES_ARCHIVE" ]] && echo "Вложения: $(du -h "$FILES_ARCHIVE" | cut -f1), файл: $FILES_ARCHIVE"
echo "Всего копий в $BACKUP_DIR: $(find "$BACKUP_DIR" -name 'plantakt_db_*.dump' | wc -l)"
