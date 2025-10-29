import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogsService } from '../../user/services/logs.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logsService: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;
    const now = Date.now();

    // Skip logging for GET requests (xem dữ liệu không cần ghi log)
    if (method === 'GET') {
      return next.handle();
    }

    // Skip logging for certain routes
    const skipRoutes = ['/api/logs', '/health', '/favicon.ico'];
    if (skipRoutes.some((route) => url.includes(route))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - now;

          // Determine action from HTTP method and URL
          const action = this.getActionFromRequest(method, url);

          // Get details from response or request
          const details = this.getDetailsFromRequest(method, url, body, data);

          // Log to database asynchronously (don't block response)
          if (user && action) {
            this.logsService
              .create({
                user_id: user.userId || user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                action: action,
                details: details,
                ip_address: request.ip,
                user_agent: request.headers['user-agent'],
                response_time: responseTime,
                status: 'success',
              })
              .catch((err) => {
                console.error('Failed to log action:', err);
              });
          }
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          const action = this.getActionFromRequest(method, url);
          const details = `Error: ${error.message}`;

          // Log errors
          if (user && action) {
            this.logsService
              .create({
                user_id: user.userId || user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                action: action,
                details: details,
                ip_address: request.ip,
                user_agent: request.headers['user-agent'],
                response_time: responseTime,
                status: 'error',
              })
              .catch((err) => {
                console.error('Failed to log error:', err);
              });
          }
        },
      }),
    );
  }

  private getActionFromRequest(method: string, url: string): string {
    // Extract meaningful action from URL and method
    if (url.includes('/auth/login')) return 'Đăng nhập hệ thống';
    if (url.includes('/auth/logout')) return 'Đăng xuất';
    if (url.includes('/auth/register')) return 'Đăng ký tài khoản';

    // Files/Documents
    if (url.includes('/files')) {
      if (method === 'POST') return 'Tải lên tài liệu';
      if (method === 'GET') return 'Xem danh sách tài liệu';
      if (method === 'PATCH' || method === 'PUT') return 'Cập nhật tài liệu';
      if (method === 'DELETE') return 'Xóa tài liệu';
    }

    // Users
    if (url.includes('/users')) {
      if (method === 'POST') return 'Tạo người dùng mới';
      if (method === 'GET') return 'Xem danh sách người dùng';
      if (method === 'PATCH' || method === 'PUT') return 'Cập nhật người dùng';
      if (method === 'DELETE') return 'Xóa người dùng';
    }

    // Roles
    if (url.includes('/roles')) {
      if (method === 'POST') return 'Tạo vai trò mới';
      if (method === 'GET') return 'Xem danh sách vai trò';
      if (method === 'PATCH' || method === 'PUT') return 'Cập nhật vai trò';
      if (method === 'DELETE') return 'Xóa vai trò';
    }

    // Permissions
    if (url.includes('/permissions')) {
      if (method === 'POST') return 'Cấp quyền';
      if (method === 'GET') return 'Xem quyền hạn';
      if (method === 'PATCH' || method === 'PUT') return 'Cập nhật quyền';
      if (method === 'DELETE') return 'Thu hồi quyền';
    }

    // Signatures
    if (url.includes('/sign')) return 'Ký số tài liệu';
    if (url.includes('/verify')) return 'Xác thực chữ ký';

    // Delegations
    if (url.includes('/delegations')) {
      if (method === 'POST') return 'Tạo ủy quyền';
      if (method === 'GET') return 'Xem danh sách ủy quyền';
      if (method === 'PATCH' || method === 'PUT') return 'Cập nhật ủy quyền';
      if (method === 'DELETE') return 'Xóa ủy quyền';
    }

    // Company
    if (url.includes('/company')) {
      if (method === 'PATCH' || method === 'PUT')
        return 'Cập nhật thông tin công ty';
      if (method === 'GET') return 'Xem thông tin công ty';
    }

    // Default
    return `${method} ${url}`;
  }

  private getDetailsFromRequest(
    method: string,
    url: string,
    body: any,
    response: any,
  ): string {
    try {
      // For file operations
      if (url.includes('/files')) {
        if (method === 'POST' && body?.original_name) {
          return `Tài liệu: ${body.original_name}`;
        }
        if (response?.filename || response?.original_name) {
          return `Tài liệu: ${response.original_name || response.filename}`;
        }
      }

      // For user operations
      if (url.includes('/users')) {
        if (body?.username || body?.email) {
          return `Người dùng: ${body.username || body.email}`;
        }
        if (response?.username || response?.email) {
          return `Người dùng: ${response.username || response.email}`;
        }
      }

      // For role operations
      if (url.includes('/roles')) {
        if (body?.name) {
          return `Vai trò: ${body.name}`;
        }
        if (response?.name) {
          return `Vai trò: ${response.name}`;
        }
      }

      // For delegation operations
      if (url.includes('/delegations')) {
        if (body?.delegator_name || body?.delegate_name) {
          return `Từ ${body.delegator_name} đến ${body.delegate_name}`;
        }
      }

      // Default: return a summary
      if (body && Object.keys(body).length > 0) {
        const keys = Object.keys(body).slice(0, 3);
        return `Dữ liệu: ${keys.join(', ')}`;
      }

      return url;
    } catch (error) {
      return url;
    }
  }
}
