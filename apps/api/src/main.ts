import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createLogger } from './common/logger/logger';

async function bootstrap() {
  const logger = createLogger();

  const app = await NestFactory.create(AppModule, {
    logger,
    // The built-in parser keeps the default 100 KB JSON limit, which a
    // base64 thumbnail upload (up to ~13 MB) exceeds. Register express
    // parsers explicitly with a 15 MB ceiling for `POST /media/thumbnails`.
    bodyParser: false,
  });
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Enables @WebSocketGateway() (chat) to run over Socket.IO on the same
  // HTTP server/port as the REST API.
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.).
  // `crossOriginResourcePolicy` is relaxed since the API legitimately serves
  // cross-origin JSON to the web app on a different origin.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Global validation for all incoming DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception handling so every error returns a consistent shape.
  app.useGlobalFilters(new AllExceptionsFilter());

  // API versioning: routes are exposed under /api/v1, /api/v2, etc.
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS is restricted to explicitly configured origin(s) — never wide open
  // in a deployed environment. Defaults to the local web app for dev.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;
  await app.listen(port);
  logger.log(`StreamHub API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
