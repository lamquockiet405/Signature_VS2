import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, user } = request;
        
        this.logger.error(`Error in ${method} ${url}:`, error.stack);
        this.logger.error(`Request Body: ${JSON.stringify(body)}`);
        if (user) {
          this.logger.error(`User: ${user.id} (${user.username})`);
        }
        
        return throwError(() => error);
      }),
    );
  }
}
