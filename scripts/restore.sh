#!/usr/bin/env bash
#
# Восстановление ПланТакт из резервной копии.
#
#   bash scripts/restore.sh                                  — показать список копий
#   bash scripts/restore.sh backups/plantakt_db_2026-07-25_0300.dump
#
# ВНИМАНИЕ: восстановление ПЕРЕЗАПИШЕТ текущую базу.
# Перед этим скрипт сам сделает страховочную копию.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-$BACKEND_DIR/uploads}"

if [[ -f "$ENV_FILE" ]]; then
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
export PGPASSWORD="${DATABASE_PASSWORD:-}"

DUMP_FILE="${1:-}"

# Без аргумента — показываем, что есть
if [[ -z "$DUMP_FILE" ]]; then
    echo "Доступные копии в $BACKUP_DIR:"
    echo
    if compgen -G "$BACKUP_DIR/plantakt_db_*.dump" >/dev/null; then
        ls -lh "$BACKUP_DIR"/plantakt_db_*.dump | awk '{print "  " $9 "  (" $5 ", " $6 " " $7 " " $8 ")"}'
        echo
        echo "Восстановить:  bash scripts/restore.sh <путь_к_файлу.dump>"
    else
        echo "  копий пока нет"
    fi
    exit 0
fi

if [[ ! -f "$DUMP_FILE" ]]; then
    echo "ОШИБКА: файл не найден: $DUMP_FILE" >&2
    exit 1
fi

if [[ -z "$DB_NAME" ]]; then
    echo "ОШИБКА: не задано имя базы (DATABASE_NAME)." >&2
    exit 1
fi

echo "Будет восстановлена база «$DB_NAME» из файла:"
echo "  $DUMP_FILE"
echo
echo "ТЕКУЩИЕ ДАННЫЕ БУДУТ ПЕРЕЗАПИСАНЫ."
read -r -p "Продолжить? Введите «да»: " CONFIRM
[[ "$CONFIRM" == "да" ]] || { echo "Отменено."; exit 0; }

# Страховочная копия перед перезаписью
SAFETY="$BACKUP_DIR/before_restore_$(date +%Y-%m-%d_%H%M).dump"
mkdir -p "$BACKUP_DIR"
echo "[1/3] Делаю страховочную копию текущей базы -> $(basename "$SAFETY")"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc -f "$SAFETY" || {
    echo "Не удалось сделать страховочную копию — восстановление прервано." >&2
    exit 1
}

echo "[2/3] Восстанавливаю базу"
# --clean --if-exists удаляет существующие объекты перед созданием
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --no-owner --no-privileges "$DUMP_FILE"

echo "[3/3] Восстанавливаю вложения (если есть архив рядом)"
STAMP="$(basename "$DUMP_FILE" | sed -E 's/plantakt_db_(.*)\.dump/\1/')"
FILES_ARCHIVE="$(dirname "$DUMP_FILE")/plantakt_files_${STAMP}.tar.gz"
if [[ -f "$FILES_ARCHIVE" ]]; then
    tar -xzf "$FILES_ARCHIVE" -C "$(dirname "$UPLOADS_DIR")"
    echo "      вложения восстановлены из $(basename "$FILES_ARCHIVE")"
else
    echo "      архива вложений с меткой $STAMP нет — пропускаю"
fi

echo
echo "Готово. Страховочная копия прежнего состояния: $SAFETY"
