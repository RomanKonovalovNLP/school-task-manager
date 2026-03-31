import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Глобальный фильтр исключений
  app.useGlobalFilters(new AllExceptionsFilter());

  // Глобальная валидация
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Убирает поля, которых нет в DTO
      forbidNonWhitelisted: true, // Выбрасывает ошибку при лишних полях
      transform: true, // Автоматически преобразует типы
    }),
  );

  // CORS для frontend
  // FIX #1: exposedHeaders позволяет браузеру читать Content-Disposition
  // Без этого заголовок недоступен фронтенду и имена файлов падают на fallback
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Backend запущен на http://localhost:${port}`);
  console.log(`📊 База данных: ${process.env.DATABASE_NAME}`);
}
bootstrap();
