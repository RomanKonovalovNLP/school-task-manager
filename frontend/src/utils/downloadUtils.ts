/**
 * F30: Общая утилита для скачивания blob-ответов.
 * Заменяет дублирующийся код в export.service, tasks.service, events.service.
 */

/**
 * Извлекает имя файла из заголовка Content-Disposition с поддержкой Unicode (RFC 5987)
 */
export function extractFilenameFromHeaders(
    contentDisposition: string | undefined,
    fallbackName: string,
): string {
    if (!contentDisposition) return fallbackName;

    // Приоритет: filename* (RFC 5987) для Unicode
    const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
    if (filenameStarMatch) {
        try {
            return decodeURIComponent(filenameStarMatch[1]);
        } catch {
            // fallthrough
        }
    }

    // Обычный filename
    const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/i);
    if (filenameMatch) {
        try {
            return decodeURIComponent(filenameMatch[1]);
        } catch {
            return filenameMatch[1];
        }
    }

    return fallbackName;
}

/**
 * Скачивает blob как файл через создание временной ссылки
 */
export function downloadBlob(data: BlobPart, fileName: string, mimeType?: string): void {
    const blob = mimeType ? new Blob([data], { type: mimeType }) : new Blob([data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
