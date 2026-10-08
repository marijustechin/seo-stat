import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * Shared application configuration, used by main.ts and by tests so the tested
 * behaviour matches production.
 */
export function configureApp(app: NestFastifyApplication): void {
  app.setGlobalPrefix('seo-stat/api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
