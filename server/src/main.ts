import 'reflect-metadata';
import * as path from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Load root .env (monorepo) then fall back to server-local .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

type RawRequest = IncomingMessage & { rawBody?: Buffer };

async function bootstrap(): Promise<void> {
  const server = express();

  // Register our own JSON body-parser first so it wins over NestJS's.
  // The `type` function runs before charset validation — we normalize
  // charset=UTF-8 to charset=utf-8 there (Telegram sends uppercase;
  // body-parser rejects it). The `verify` function captures rawBody
  // so the Paystack webhook can verify its HMAC signature.
  server.use(
    express.json({
      limit: '10mb',
      type: (req: IncomingMessage) => {
        const ct = req.headers['content-type'] ?? '';
        if (ct && /charset=/i.test(ct)) {
          req.headers['content-type'] = ct.replace(
            /charset=([^;,\s]+)/gi,
            (_m, cs: string) => `charset=${cs.toLowerCase()}`,
          );
        }
        return /^application\/json/i.test(req.headers['content-type'] ?? '');
      },
      verify: (req: RawRequest, _res: ServerResponse, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  // rawBody is now handled above — do not pass rawBody:true or NestJS would
  // register a second body-parser that fails on the already-parsed body.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

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
