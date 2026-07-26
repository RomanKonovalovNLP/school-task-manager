import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // ИСПРАВЛЕНИЕ: разворачиваем message в строку/массив, а не в объект.
        // exception.getResponse() у HttpException часто возвращает объект
        // { statusCode, message, error }. Если положить его целиком в поле
        // message, фронтенд получит объект и падает при рендере (нельзя
        // отрисовать объект как React-child) — бывает белый экран при ошибке входа.
        let message: string | string[] = 'Internal server error';
        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            } else if (res && typeof res === 'object' && 'message' in (res as any)) {
                message = (res as any).message;
            } else {
                message = exception.message;
            }
        }

        // Логируем ошибку
        this.logger.error(
            `${request.method} ${request.url}`,
            exception instanceof Error ? exception.stack : 'Unknown error',
        );

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }
}
