#!/usr/bin/env bash
#
# Подготовка сервера к работе с ПРИВАТНЫМ репозиторием.
#
# Запускать НА СЕРВЕРЕ, до того как переключите репозиторий в приватный режим:
#   bash scripts/setup-deploy-key.sh
#
# Скрипт создаёт отдельный SSH-ключ только для этого сервера, настраивает
# подключение к GitHub и печатает публичную часть — её нужно добавить
# в настройки репозитория (Deploy keys). Приватный ключ сервер не покидает.

set -euo pipefail

KEY_PATH="${KEY_PATH:-/root/.ssh/id_ed25519_plantakt}"
APP_DIR="${APP_DIR:-/root/plantakt}"
REPO_SSH="git@github.com:RomanKonovalovNLP/school-task-manager.git"

mkdir -p "$(dirname "$KEY_PATH")"
chmod 700 "$(dirname "$KEY_PATH")"

# ---------- 1. Ключ ----------
if [ -f "$KEY_PATH" ]; then
    echo ">>> Ключ уже существует: $KEY_PATH"
else
    echo ">>> Создаю ключ доступа для сервера..."
    ssh-keygen -t ed25519 -C "plantakt-server-$(hostname)" -f "$KEY_PATH" -N "" >/dev/null
    echo "    создан: $KEY_PATH"
fi

# ---------- 2. Настройка SSH ----------
SSH_CONFIG="/root/.ssh/config"
if ! grep -q "Host github.com" "$SSH_CONFIG" 2>/dev/null; then
    echo ">>> Прописываю github.com в $SSH_CONFIG"
    cat >> "$SSH_CONFIG" <<EOF

Host github.com
    HostName github.com
    User git
    IdentityFile $KEY_PATH
    IdentitiesOnly yes
EOF
    chmod 600 "$SSH_CONFIG"
fi

# Доверяем хосту, чтобы git не спрашивал подтверждение при первом обращении
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null
sort -u /root/.ssh/known_hosts -o /root/.ssh/known_hosts

# ---------- 3. Показать публичный ключ ----------
echo
echo "==================== ДОБАВЬТЕ ЭТОТ КЛЮЧ НА GITHUB ===================="
echo
cat "${KEY_PATH}.pub"
echo
echo "======================================================================"
echo
echo "Куда добавить:"
echo "  1. Откройте https://github.com/RomanKonovalovNLP/school-task-manager/settings/keys"
echo "  2. Add deploy key"
echo "  3. Title: сервер plantakt"
echo "  4. Key: скопируйте строку выше целиком"
echo "  5. Allow write access — НЕ включать (серверу нужно только читать)"
echo "  6. Add key"
echo
read -r -p "Нажмите Enter, когда ключ будет добавлен на GitHub..."

# ---------- 4. Проверка доступа ----------
echo ">>> Проверяю доступ к GitHub..."
if ssh -T -o StrictHostKeyChecking=no git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "    доступ есть"
else
    echo "    ВНИМАНИЕ: GitHub не подтвердил ключ. Проверьте, что добавили его в Deploy keys."
fi

# ---------- 5. Переключение репозитория на SSH ----------
if [ -d "$APP_DIR/.git" ]; then
    echo ">>> Переключаю $APP_DIR на доступ по ключу"
    git -C "$APP_DIR" remote set-url origin "$REPO_SSH"
    echo "    текущий адрес: $(git -C "$APP_DIR" remote get-url origin)"

    echo ">>> Пробую получить изменения..."
    if git -C "$APP_DIR" fetch origin >/dev/null 2>&1; then
        echo "    получилось — сервер готов к приватному репозиторию"
    else
        echo "    НЕ получилось. Не делайте репозиторий приватным, пока это не заработает."
        exit 1
    fi
else
    echo ">>> Каталог $APP_DIR ещё не склонирован — при первом деплое будет использован SSH-адрес"
fi

echo
echo "Готово. Теперь можно переключать репозиторий в приватный режим:"
echo "  https://github.com/RomanKonovalovNLP/school-task-manager/settings"
echo "  → Danger Zone → Change repository visibility → Make private"
