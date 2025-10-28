import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global HTTP Exception Filter
 * Provides consistent error response format across the application
 * with special handling for permission-related errors
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Custom message for 403 Forbidden (Permission denied)
    if (exception instanceof ForbiddenException) {
      return response.status(status).json({
        statusCode: status,
        message:
          'Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ với quản trị viên.',
        error: 'Forbidden',
        timestamp: new Date().toISOString(),
        path: ctx.getRequest().url,
      });
    }

    // Custom message for 401 Unauthorized (Not logged in)
    if (exception instanceof UnauthorizedException) {
      return response.status(status).json({
        statusCode: status,
        message: 'Vui lòng đăng nhập để tiếp tục.',
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
        path: ctx.getRequest().url,
      });
    }

    // Standard error response for other HTTP exceptions
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      ...(typeof exceptionResponse === 'object'
        ? exceptionResponse
        : { message: exceptionResponse }),
    };

    response.status(status).json(errorResponse);
  }
}
