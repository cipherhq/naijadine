import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Sentry error tracking (only when SENTRY_DSN is set and package installed)
if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    console.log('Sentry initialized');
  } catch {
    console.log('Sentry package not installed — skipping');
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Compression
  app.use(compression());

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://dineroot.com',
      'https://dashboard.dineroot.com',
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
  console.log(`DineRoot API running on port ${port}`);
}
bootstrap();
