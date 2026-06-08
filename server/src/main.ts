import 'reflect-metadata';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

// Load root .env (monorepo) then fall back to server-local .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({ origin: process.env['APP_URL'] ?? 'http://localhost:5173' });

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
