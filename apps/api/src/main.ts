import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://naijadine.com',
      'https://dashboard.naijadine.com',
      /\.onrender\.com$/,
    ],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Request body size limit
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(require('express').json({ limit: '10mb' }));

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`NaijaDine API running on port ${port}`);
}
bootstrap();
