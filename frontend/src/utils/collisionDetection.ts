/**
 * Утилиты для определения перекрытия (collision detection) тасок на canvas
 */

export interface TaskRect {
    taskId: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CollisionResult {
    hasCollision: boolean;
    collidingTaskIds: number[];
    overlapPercentages: Map<number, number>;
}

/**
 * Вычисляет процент наложения draggedTask на targetTask
 * 
 * @param dragged - Перетаскиваемая таска
 * @param target - Целевая таска
 * @returns Процент наложения (0-100)
 */
export function calculateOverlapPercentage(
    dragged: TaskRect,
    target: TaskRect
): number {
    // Находим координаты пересечения
    const overlapLeft = Math.max(dragged.x, target.x);
    const overlapTop = Math.max(dragged.y, target.y);
    const overlapRight = Math.min(
        dragged.x + dragged.width,
        target.x + target.width
    );
    const overlapBottom = Math.min(
        dragged.y + dragged.height,
        target.y + target.height
    );

    // Проверяем, есть ли пересечение
    if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
        return 0;
    }

    const overlapWidth = overlapRight - overlapLeft;
    const overlapHeight = overlapBottom - overlapTop;
    const overlapArea = overlapWidth * overlapHeight;

    // Считаем процент относительно площади перетаскиваемой таски
    const draggedArea = dragged.width * dragged.height;
    return (overlapArea / draggedArea) * 100;
}

/**
 * Определяет все коллизии для перетаскиваемой таски
 * 
 * @param draggedTask - Перетаскиваемая таска
 * @param allTasks - Все остальные таски на canvas
 * @param threshold - Порог перекрытия в процентах (по умолчанию 50%)
 * @returns Результат с информацией о коллизиях
 */
export function detectCollisions(
    draggedTask: TaskRect,
    allTasks: TaskRect[],
    threshold: number = 50
): CollisionResult {
    const overlapPercentages = new Map<number, number>();
    const collidingTaskIds: number[] = [];

    allTasks.forEach((task) => {
        if (task.taskId === draggedTask.taskId) return;

        const overlap = calculateOverlapPercentage(draggedTask, task);

        if (overlap > 0) {
            overlapPercentages.set(task.taskId, overlap);
        }

        if (overlap >= threshold) {
            collidingTaskIds.push(task.taskId);
        }
    });

    return {
        hasCollision: collidingTaskIds.length > 0,
        collidingTaskIds,
        overlapPercentages,
    };
}

/**
 * Находит таску с максимальным наложением
 * Полезно для определения в какую группу добавлять
 * 
 * @param collisionResult - Результат проверки коллизий
 * @returns ID таски с максимальным наложением или null
 */
export function findBestCollisionTarget(
    collisionResult: CollisionResult
): number | null {
    if (!collisionResult.hasCollision) return null;

    let maxOverlap = 0;
    let bestTargetId: number | null = null;

    collisionResult.overlapPercentages.forEach((overlap, taskId) => {
        if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestTargetId = taskId;
        }
    });

    return bestTargetId;
}

/**
 * Проверяет, находится ли точка внутри прямоугольника
 * 
 * @param point - Координаты точки
 * @param rect - Прямоугольник
 * @returns true если точка внутри прямоугольника
 */
export function isPointInsideRect(
    point: { x: number; y: number },
    rect: TaskRect
): boolean {
    return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
    );
}

/**
 * Выравнивает координату по сетке
 * 
 * @param value - Исходное значение
 * @param gridSize - Размер ячейки сетки
 * @returns Выровненное значение
 */
export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Вычисляет расстояние между двумя точками
 */
export function getDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Находит ближайшую таску к заданной точке
 */
export function findNearestTask(
    point: { x: number; y: number },
    tasks: TaskRect[]
): number | null {
    let minDistance = Infinity;
    let nearestTaskId: number | null = null;

    tasks.forEach((task) => {
        const taskCenter = {
            x: task.x + task.width / 2,
            y: task.y + task.height / 2,
        };
        const distance = getDistance(point, taskCenter);

        if (distance < minDistance) {
            minDistance = distance;
            nearestTaskId = task.taskId;
        }
    });

    return nearestTaskId;
}