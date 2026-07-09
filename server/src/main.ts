import 'reflect-metadata';
import * as path from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Load root .env (monorepo) then fall back to server-local .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function bootstrap(): Promise<void> {
  const server = express();

  // body-parser rejects charset=UTF-8 (uppercase) which some browsers send.
  // Normalize before NestJS registers its body-parser.
  server.use((req, _res, next) => {
    const ct = req.headers['content-type'];
    if (ct) req.headers['content-type'] = ct.replace(/charset=UTF-8/g, 'charset=utf-8');
    next();
  });

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });

  app.enableCors({ origin: process.env['APP_URL'] ?? 'http://localhost:5173' });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env['SERVER_PORT'] ?? 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

bootstrap().catch(console.error);
