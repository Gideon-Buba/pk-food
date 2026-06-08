import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface ControllerResult<T> {
  data: T;
  message?: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<ControllerResult<T>, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<ControllerResult<T>>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => ({
        success: true,
        data: result?.data ?? (result as unknown as T),
        message: result?.message ?? 'OK',
      })),
    );
  }
}
