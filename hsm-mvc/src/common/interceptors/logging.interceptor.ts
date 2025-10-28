import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const user = request.user;
    
    const startTime = Date.now();
    
    this.logger.log(`Incoming Request: ${method} ${url}`);
    this.logger.debug(`Request Body: ${JSON.stringify(body)}`);
    this.logger.debug(`Query Params: ${JSON.stringify(query)}`);
    this.logger.debug(`Path Params: ${JSON.stringify(params)}`);
    if (user) {
      this.logger.debug(`User: ${user.id} (${user.username})`);
    }

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.logger.log(`Request completed: ${method} ${url} - ${duration}ms`);
      }),
    );
  }
}
