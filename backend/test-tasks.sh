#!/bin/bash

echo "==========================================="
echo "Комплексное тестирование системы тасок"
echo "==========================================="
echo ""

# 1. Создать тестовые данные
echo "1. Создание тестовых данных..."
curl -s -X POST http://localhost:3000/schools/seed
echo ""
echo ""

# 2. Вход админа
echo "2. Вход администратора..."
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Иванов Иван Иванович", "adminPassword": "admin123", "schoolPassword": "school123"}' \
  | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)
echo "Токен админа: $ADMIN_TOKEN"
echo ""

# 3. Создать категории
echo "3. Создание категорий..."
curl -s -X POST http://localhost:3000/filters/seed \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo ""
echo ""

# 4. Получить список категорий
echo "4. Получение категорий..."
curl -s -X GET http://localhost:3000/filters \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_pp
echo ""

# 5. Создать таску
echo "5. Создание задачи..."
TASK_ID=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Подготовить отчет по успеваемости",
    "description": "Нужно собрать данные за последний месяц и составить аналитический отчет",
    "deadline": "2025-12-15T18:00:00.000Z",
    "assigneeCategories": ["Учителя математики", "Завучи"]
  }' | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Создана задача с ID: $TASK_ID"
echo ""

# 6. Получить все таски
echo "6. Получение всех задач..."
curl -s -X GET http://localhost:3000/tasks \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_pp
echo ""

# 7. Вход гостя
echo "7. Вход гостя..."
GUEST_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Петров Сергей Викторович", "schoolPassword": "school123"}' \
  | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)
echo "Токен гостя: $GUEST_TOKEN"
echo ""

# 8. Гость просматривает таску
echo "8. Гость отмечает просмотр задачи..."
curl -s -X POST http://localhost:3000/tasks/$TASK_ID/view \
  -H "Authorization: Bearer $GUEST_TOKEN"
echo ""
echo ""

# 9. Админ проверяет просмотры
echo "9. Админ проверяет кто просмотрел задачу..."
curl -s -X GET http://localhost:3000/tasks/$TASK_ID/views \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_pp
echo ""

# 10. Гость создает свою таску
echo "10. Гость создает свою задачу..."
GUEST_TASK_ID=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $GUEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Проверить контрольные работы",
    "description": "5А класс, математика",
    "deadline": "2025-12-16T12:00:00.000Z",
    "assigneeCategories": ["Учителя математики"]
  }' | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Гость создал задачу с ID: $GUEST_TASK_ID"
echo ""

# 11. Гость пытается удалить чужую таску (должна быть ошибка)
echo "11. Гость пытается удалить чужую задачу (должна быть ошибка 403)..."
curl -s -X DELETE http://localhost:3000/tasks/$TASK_ID \
  -H "Authorization: Bearer $GUEST_TOKEN"
echo ""
echo ""

# 12. Гость удаляет свою таску (должно работать)
echo "12. Гость удаляет свою задачу..."
curl -s -X DELETE http://localhost:3000/tasks/$GUEST_TASK_ID \
  -H "Authorization: Bearer $GUEST_TOKEN"
echo ""
echo ""

# 13. Создать просроченную таску для теста
echo "13. Создание просроченной задачи..."
OVERDUE_TASK_ID=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Просроченная задача",
    "description": "Эта задача уже просрочена",
    "deadline": "2023-01-01T12:00:00.000Z",
    "assigneeCategories": ["Все учителя"]
  }' | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Создана просроченная задача с ID: $OVERDUE_TASK_ID"
echo ""

# 14. Получить таски с фильтром по категории
echo "14. Фильтрация задач по категории 'Завучи'..."
curl -s -X GET "http://localhost:3000/tasks?category=Завучи" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_pp
echo ""

# 15. Админ удаляет все просроченные таски
echo "15. Админ удаляет все просроченные задачи..."
curl -s -X DELETE http://localhost:3000/tasks/overdue/all \
  -H "Authorization: Bearer $ADMIN_TOKEN"
echo ""
echo ""

echo "==========================================="
echo "Тестирование завершено!"
echo "==========================================="