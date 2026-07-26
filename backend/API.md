# API Документация - School Task Manager

## Базовый URL
http://localhost:3000

## Авторизация
Все защищенные эндпоинты требуют заголовок:
Authorization: Bearer {sessionToken}

## Auth Endpoints

### 1. Вход гостя
```http
POST /auth/login
Content-Type: application/json

{
  "fullName": "Иванов Петр Сергеевич",
  "schoolPassword": "school123"
}
```

**Ответ:**
```json
{
  "sessionToken": "abc123...",
  "fullName": "Иванов Петр Сергеевич",
  "schoolId": 1,
  "schoolName": "Школа №1 г. Москва",
  "isAdmin": false
}
```

### 2. Вход администратора
```http
POST /auth/admin-login
Content-Type: application/json

{
  "fullName": "Иванов Иван Иванович",
  "adminPassword": "admin123",
  "schoolPassword": "school123"
}
```

### 3. Проверка сессии
```http
GET /auth/session
Authorization: Bearer {token}
```

### 4. Выход
```http
DELETE /auth/logout
Authorization: Bearer {token}
```

---

## Tasks Endpoints

### 1. Создать таску
```http
POST /tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Подготовить отчет",
  "description": "Детальное описание задачи",
  "deadline": "2025-12-20T18:00:00.000Z",
  "assigneeCategories": ["Учителя математики", "Завучи"]
}
```

### 2. Получить все таски
```http
GET /tasks
Authorization: Bearer {token}

# С фильтрами:
GET /tasks?category=Учителя математики
GET /tasks?priority=urgent
GET /tasks?creatorName=Иванов Иван Иванович
```

**Приоритеты:**
- `urgent` - до дедлайна < 24 часов (красный)
- `medium` - до дедлайна < 72 часов (желтый)
- `low` - до дедлайна > 72 часов (зеленый)
- `overdue` - дедлайн прошел (серый)

### 3. Получить таску по ID
```http
GET /tasks/{id}
Authorization: Bearer {token}
```

### 4. Обновить таску
```http
PATCH /tasks/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Новое название",
  "deadline": "2025-12-25T18:00:00.000Z"
}
```

**Права:** Гость может редактировать только свои таски, админ - любые.

### 5. Удалить таску
```http
DELETE /tasks/{id}
Authorization: Bearer {token}
```

**Права:** Гость может удалять только свои таски, админ - любые.

### 6. Удалить все просроченные таски
```http
DELETE /tasks/overdue/all
Authorization: Bearer {adminToken}
```

**Права:** Только администраторы.

### 7. Отметить просмотр таски
```http
POST /tasks/{id}/view
Authorization: Bearer {token}
```

### 8. Получить список просмотревших
```http
GET /tasks/{id}/views
Authorization: Bearer {token}
```

**Права:** Создатель таски или админ.

---

## Filters (Categories) Endpoints

### 1. Получить все категории
```http
GET /filters
Authorization: Bearer {token}
```

### 2. Создать категорию
```http
POST /filters
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "categoryName": "Психологи"
}
```

**Права:** Только администраторы.

### 3. Удалить категорию
```http
DELETE /filters/{id}
Authorization: Bearer {adminToken}
```

**Права:** Только администраторы.

### 4. Создать тестовые категории
```http
POST /filters/seed
Authorization: Bearer {adminToken}
```

---

## Schools Endpoints

### 1. Создать тестовые данные
```http
POST /schools/seed
```

### 2. Получить информацию о школе
```http
GET /schools/info
```

---

## Коды ошибок

- `400` - Неверные данные в запросе
- `401` - Не авторизован (нет токена или токен недействителен)
- `403` - Доступ запрещен (недостаточно прав)
- `404` - Ресурс не найден
- `409` - Конфликт (например, категория уже существует)
- `500` - Внутренняя ошибка сервера

---

## Примеры использования

### Полный workflow для гостя:

1. Вход:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"fullName": "Петров Петр", "schoolPassword": "school123"}' \
  | jq -r '.sessionToken')
```

2. Получить список тасок:
```bash
curl -X GET http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN"
```

3. Создать таску:
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Моя задача",
    "description": "Описание",
    "deadline": "2025-12-20T18:00:00.000Z",
    "assigneeCategories": ["Все учителя"]
  }'
```

4. Выход:
```bash
curl -X DELETE http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```