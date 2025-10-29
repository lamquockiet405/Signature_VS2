import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FilteredLogHelper } from '../helpers/filtered-log.helper';
import { DatabaseService } from '../../database/database.service';

/**
 * Filtered Logging Interceptor
 * Chỉ log các action quan trọng liên quan đến file, ủy quyền và ký
 */
@Injectable()
export class FilteredLoggingInterceptor implements NestInterceptor {
  constructor(private readonly databaseService: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;
    const now = Date.now();

    // Skip logging for GET requests (xem dữ liệu không cần ghi log)
    if (method === 'GET') {
      return next.handle();
    }

    // Skip logging for certain routes
    const skipRoutes = [
      '/api/logs',
      '/health',
      '/favicon.ico',
      '/api/auth/me',
      '/api/users/profile',
      '/api/roles',
      '/api/company',
    ];
    if (skipRoutes.some((route) => url.includes(route))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - now;

          // Determine action from HTTP method and URL
          const action = this.getActionFromRequest(method, url);
          const module = this.getModuleFromUrl(url);

          // Chỉ log nếu action và module được phép
          if (user && action && this.shouldLogAction(action, module)) {
            const details = this.getDetailsFromRequest(method, url, body, data);

            // Log to database asynchronously (don't block response)
            FilteredLogHelper.createFilteredLog(this.databaseService, {
              userId: user.userId || user.id,
              action: action,
              module: module,
              description: details,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              metadata: {
                responseTime,
                status: 'success',
                url,
                method,
              },
            }).catch((err) => {
              console.error('Failed to log filtered action:', err);
            });
          }
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          const action = this.getActionFromRequest(method, url);
          const module = this.getModuleFromUrl(url);

          // Chỉ log error nếu action được phép
          if (user && action && this.shouldLogAction(action, module)) {
            FilteredLogHelper.createFilteredLog(this.databaseService, {
              userId: user.userId || user.id,
              action: action,
              module: module,
              description: `Error: ${error.message}`,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              metadata: {
                responseTime,
                status: 'error',
                error: error.message,
                url,
                method,
              },
            }).catch((err) => {
              console.error('Failed to log filtered error:', err);
            });
          }
        },
      }),
    );
  }

  /**
   * Kiểm tra xem có nên log action này không
   */
  private shouldLogAction(action: string, module: string): boolean {
    const allowedActions = FilteredLogHelper.getAllowedActions();
    const allowedModules = FilteredLogHelper.getAllowedModules();

    return allowedActions.includes(action) && allowedModules.includes(module);
  }

  /**
   * Xác định action từ HTTP method và URL
   */
  private getActionFromRequest(method: string, url: string): string {
    // File operations
    if (url.includes('/api/files') || url.includes('/api/documents')) {
      if (method === 'POST') return 'FILE_UPLOAD';
      if (method === 'PUT') return 'FILE_UPDATE';
      if (method === 'DELETE') return 'FILE_DELETE';
      if (url.includes('/download')) return 'FILE_DOWNLOAD';
    }

    // Document signing
    if (url.includes('/api/document-signatures')) {
      if (url.includes('/sign')) return 'DOCUMENT_SIGN';
      if (url.includes('/approve')) return 'DOCUMENT_APPROVE';
      if (url.includes('/reject')) return 'DOCUMENT_REJECT';
    }

    // Delegations
    if (url.includes('/api/delegations')) {
      if (method === 'POST') return 'DELEGATION_CREATE';
      if (method === 'PUT') return 'DELEGATION_UPDATE';
      if (method === 'DELETE') return 'DELEGATION_DELETE';
    }

    // Workflows
    if (url.includes('/api/workflows')) {
      if (method === 'POST') return 'WORKFLOW_DELEGATION_CREATE';
      if (url.includes('/approve')) return 'WORKFLOW_APPROVED';
      if (url.includes('/reject')) return 'WORKFLOW_REJECTED';
      if (url.includes('/sign')) return 'WORKFLOW_SIGNED';
      if (url.includes('/cancel')) return 'WORKFLOW_CANCELLED';
    }

    // TOTP operations
    if (url.includes('/api/auth/totp')) {
      if (url.includes('/setup')) return 'TOTP_SETUP';
      if (url.includes('/verify')) return 'TOTP_VERIFY';
    }

    // HSM operations
    if (url.includes('/api/hsm')) {
      if (url.includes('/sign')) return 'HSM_SIGN';
      if (url.includes('/verify')) return 'HSM_VERIFY';
    }

    return '';
  }

  /**
   * Xác định module từ URL
   */
  private getModuleFromUrl(url: string): string {
    if (url.includes('/api/files') || url.includes('/api/documents'))
      return 'files';
    if (url.includes('/api/delegations')) return 'delegations';
    if (url.includes('/api/workflows')) return 'workflow';
    if (url.includes('/api/document-signatures')) return 'signature';
    if (url.includes('/api/auth/totp')) return 'totp';
    if (url.includes('/api/hsm')) return 'hsm';

    return '';
  }

  /**
   * Lấy thông tin chi tiết từ request
   */
  private getDetailsFromRequest(
    method: string,
    url: string,
    body: any,
    data: any,
  ): string {
    // File operations
    if (url.includes('/api/files') || url.includes('/api/documents')) {
      const fileName =
        body?.name || body?.filename || data?.name || 'Unknown file';
      return `${method.toUpperCase()} file: ${fileName}`;
    }

    // Document signing
    if (url.includes('/api/document-signatures')) {
      const documentName =
        body?.documentName || data?.documentName || 'Unknown document';
      if (url.includes('/sign')) return `Signed document: ${documentName}`;
      if (url.includes('/approve')) return `Approved document: ${documentName}`;
      if (url.includes('/reject')) return `Rejected document: ${documentName}`;
    }

    // Delegations
    if (url.includes('/api/delegations')) {
      const delegatorName =
        body?.delegator_name || data?.delegator_name || 'Unknown delegator';
      const delegateName =
        body?.delegate_name || data?.delegate_name || 'Unknown delegate';
      return `${method.toUpperCase()} delegation: ${delegatorName} → ${delegateName}`;
    }

    // Workflows
    if (url.includes('/api/workflows')) {
      const workflowType =
        body?.workflow_type || data?.workflow_type || 'Unknown type';
      return `${method.toUpperCase()} workflow: ${workflowType}`;
    }

    // TOTP
    if (url.includes('/api/auth/totp')) {
      if (url.includes('/setup')) return 'TOTP setup initiated';
      if (url.includes('/verify')) return 'TOTP verification';
    }

    return `${method.toUpperCase()} ${url}`;
  }
}
