import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // ignoreTrailingSlash keeps the API tolerant of the trailing slash used by
    // the Next.js `trailingSlash: true` option and by the nginx config.
    new FastifyAdapter({ routerOptions: { ignoreTrailingSlash: true } }),
  );

  app.setGlobalPrefix('seo-stat/api');
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3011);
  // Bind to loopback only; nginx is the public entry point.
  await app.listen(port, '127.0.0.1');
}

void bootstrap();
