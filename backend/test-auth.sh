#!/bin/bash

echo "==================================="
echo "Тестирование авторизации"
echo "==================================="
echo ""

echo "1. Создание тестовых данных..."
curl -s -X POST http://localhost:3000/schools/seed | json_pp
echo ""
echo ""

echo "2. Вход гостя..."
GUEST_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Тестовый Пользователь", "schoolPassword": "school123"}' \
  | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)

echo "Получен токен гостя: $GUEST_TOKEN"
echo ""

echo "3. Проверка сессии гостя..."
curl -s -X GET http://localhost:3000/auth/session \
  -H "Authorization: Bearer $GUEST_TOKEN" | json_pp
echo ""
echo ""

echo "4. Вход админа..."
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Иванов Иван Иванович", "adminPassword": "admin123", "schoolPassword": "school123"}' \
  | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)

echo "Получен токен админа: $ADMIN_TOKEN"
echo ""

echo "5. Проверка сессии админа..."
curl -s -X GET http://localhost:3000/auth/session \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_pp
echo ""
echo ""

echo "6. Выход из системы (гость)..."
curl -s -X DELETE http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $GUEST_TOKEN" | json_pp
echo ""

echo "==================================="
echo "Тесты завершены"
echo "==================================="