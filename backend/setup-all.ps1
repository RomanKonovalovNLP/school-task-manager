# setup-all.ps1
# Полная настройка: категории + таски

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "FULL SETUP: Categories + Tasks" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# === ВХОД АДМИНА ===
Write-Host "1. Admin login..." -ForegroundColor Yellow

$loginJson = '{"fullName":"Иванов Иван Иванович","adminPassword":"admin123","schoolPassword":"school123"}'
$loginBytes = [System.Text.Encoding]::UTF8.GetBytes($loginJson)

try {
  $loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/admin-login" `
    -Method Post `
    -ContentType "application/json; charset=utf-8" `
    -Body $loginBytes
  
  $token = $loginResponse.sessionToken
  Write-Host "   Success! Admin: $($loginResponse.fullName)" -ForegroundColor Green
  Write-Host ""
} catch {
  Write-Host "   ERROR: Login failed!" -ForegroundColor Red
  Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json; charset=utf-8"
}

# === СОЗДАНИЕ КАТЕГОРИЙ ===
Write-Host "2. Creating categories..." -ForegroundColor Yellow

try {
  Invoke-RestMethod -Uri "http://localhost:3000/filters/seed" `
    -Method Post `
    -Headers $headers | Out-Null
  Write-Host "   Success!" -ForegroundColor Green
} catch {
  Write-Host "   Already exist or error" -ForegroundColor Yellow
}

# Проверить категории
$categories = Invoke-RestMethod -Uri "http://localhost:3000/filters" `
  -Method Get `
  -Headers $headers

Write-Host "   Categories found: $($categories.Count)" -ForegroundColor Cyan
foreach ($cat in $categories) {
  Write-Host "      - $($cat.categoryName)" -ForegroundColor Gray
}
Write-Host ""

# === УДАЛЕНИЕ СТАРЫХ ТАСОК ===
Write-Host "3. Cleaning old tasks..." -ForegroundColor Yellow

$oldTasks = Invoke-RestMethod -Uri "http://localhost:3000/tasks" `
  -Method Get `
  -Headers $headers

if ($oldTasks.Count -gt 0) {
  Write-Host "   Deleting $($oldTasks.Count) old tasks..." -ForegroundColor Yellow
  foreach ($task in $oldTasks) {
    try {
      Invoke-RestMethod -Uri "http://localhost:3000/tasks/$($task.id)" `
        -Method Delete `
        -Headers $headers | Out-Null
    } catch {
      Write-Host "   Could not delete task $($task.id)" -ForegroundColor Yellow
    }
  }
  Write-Host "   Old tasks deleted!" -ForegroundColor Green
} else {
  Write-Host "   No old tasks to delete" -ForegroundColor Gray
}
Write-Host ""

# === СОЗДАНИЕ НОВЫХ ТАСОК ===
Write-Host "4. Creating new tasks..." -ForegroundColor Yellow
Write-Host ""

function New-Task {
  param(
    [string]$Title,
    [string]$Description,
    [int]$HoursFromNow,
    [string[]]$Categories,
    [hashtable]$Headers
  )
  
  $deadline = (Get-Date).AddHours($HoursFromNow).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
  
  $taskData = @{
    title = $Title
    description = $Description
    deadline = $deadline
    assigneeCategories = $Categories
  } | ConvertTo-Json -Depth 10
  
  $taskBytes = [System.Text.Encoding]::UTF8.GetBytes($taskData)
  
  Invoke-RestMethod -Uri "http://localhost:3000/tasks" `
    -Method Post `
    -Headers $Headers `
    -Body $taskBytes
}

# Таска 1: СРОЧНАЯ (12 часов) - КРАСНАЯ
Write-Host "   Creating: URGENT task (12h)" -ForegroundColor Red
$t1 = New-Task `
  -Title "СРОЧНО: Подготовить документы к совещанию" `
  -Description "Собрать все отчеты по успеваемости за текущий месяц и подготовить презентацию для директора" `
  -HoursFromNow 12 `
  -Categories @("Завучи", "Учителя математики") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t1.id)" -ForegroundColor Green

# Таска 2: СРЕДНЯЯ (48 часов) - ЖЕЛТАЯ
Write-Host "   Creating: MEDIUM task (48h)" -ForegroundColor Yellow
$t2 = New-Task `
  -Title "Провести родительское собрание" `
  -Description "Обсудить итоги четверти и планы на следующую четверть. Подготовить раздаточные материалы" `
  -HoursFromNow 48 `
  -Categories @("Классные руководители") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t2.id)" -ForegroundColor Green

# Таска 3: НЕСРОЧНАЯ (7 дней) - ЗЕЛЕНАЯ
Write-Host "   Creating: LOW priority task (7d)" -ForegroundColor Green
$t3 = New-Task `
  -Title "Обновить учебные материалы" `
  -Description "Подготовить новые презентации и раздаточные материалы для следующей темы по математике" `
  -HoursFromNow 168 `
  -Categories @("Все учителя", "Учителя математики") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t3.id)" -ForegroundColor Green

# Таска 4: ПРОСРОЧЕННАЯ - СЕРАЯ
Write-Host "   Creating: OVERDUE task" -ForegroundColor Gray
$t4 = New-Task `
  -Title "ПРОСРОЧЕНО: Проверить контрольные работы" `
  -Description "Эта задача уже просрочена. Нужно было проверить контрольные работы 5А класса" `
  -HoursFromNow -24 `
  -Categories @("Учителя математики") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t4.id)" -ForegroundColor Green

# Таска 5: СРОЧНАЯ (6 часов) - КРАСНАЯ
Write-Host "   Creating: URGENT task #2 (6h)" -ForegroundColor Red
$t5 = New-Task `
  -Title "СРОЧНО: Отправить отчет в департамент" `
  -Description "Deadline сегодня! Нужно отправить ежемесячный отчет о посещаемости и успеваемости" `
  -HoursFromNow 6 `
  -Categories @("Директор", "Завучи") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t5.id)" -ForegroundColor Green

# Таска 6: НЕСРОЧНАЯ (5 дней) - ЗЕЛЕНАЯ
Write-Host "   Creating: LOW priority task #2 (5d)" -ForegroundColor Green
$t6 = New-Task `
  -Title "Заполнить электронный журнал" `
  -Description "Всем учителям необходимо заполнить электронный журнал за текущую неделю. Проверьте оценки и комментарии" `
  -HoursFromNow 120 `
  -Categories @("Все учителя") `
  -Headers $headers
Write-Host "      ✓ Created ID: $($t6.id)" -ForegroundColor Green

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✓ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "  • Categories: $($categories.Count)" -ForegroundColor Cyan
Write-Host "  • Tasks created: 6" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tasks by priority:" -ForegroundColor White
Write-Host "  • 2 URGENT (RED)" -ForegroundColor Red
Write-Host "  • 1 MEDIUM (YELLOW)" -ForegroundColor Yellow
Write-Host "  • 2 LOW (GREEN)" -ForegroundColor Green
Write-Host "  • 1 OVERDUE (GRAY)" -ForegroundColor Gray
Write-Host ""
Write-Host "Open http://localhost:3000 to see them!" -ForegroundColor Cyan
Write-Host ""