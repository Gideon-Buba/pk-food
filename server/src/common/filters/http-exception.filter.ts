import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

interface HttpExceptionBody {
  message: string | string[];
  statusCode?: number;
  error?: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    let message: string;
    if (typeof body === 'string') {
      message = body;
    } else {
      const parsed = body as HttpExceptionBody;
      message = Array.isArray(parsed.message)
        ? parsed.message.join(', ')
        : parsed.message;
    }

    response.status(status).json({
      success: false,
      data: null,
      message,
    });
  }
}
