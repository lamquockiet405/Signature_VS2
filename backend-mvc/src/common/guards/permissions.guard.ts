import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * PermissionsGuard - Checks if user has required permission
 * Must be used AFTER JwtAuthGuard to ensure request.user exists
 * Usage: @UseGuards(JwtAuthGuard, PermissionsGuard)
 *        @RequirePermission('documents', 'create')
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly moduleAlias = (m: string) => {
    const mm = String(m || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    // Return module name as-is, no conversion
    // This matches the exact module names in role_permissions table
    return mm;
  };

  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Get required permission from @RequirePermission decorator
    const requiredPermission = this.reflector.getAllAndOverride<{
      module: string;
      action: string;
    }>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // 2. ✅ ALLOW BY DEFAULT - If no permission decorator, ALLOW ACCESS
    // Routes without @RequirePermission are considered public (after JWT auth)
    if (!requiredPermission) {
      console.log(
        `✅ [PERMISSION GUARD] No @RequirePermission decorator - allowing access`,
      );
      return true; // Allow access
    }

    // 3. Get user from request (set by JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    interface JwtUser {
      userId: string | number;
      roleId: string | number | null;
      role?: string;
      permissions?: string[];
    }
    const user = (request.user || {}) as JwtUser;

    // Get userId from JWT or from x-user-id header
    const userIdFromJwt = user?.userId;
    const userIdFromHeader = request.headers?.['x-user-id'];
    const userId = userIdFromJwt || userIdFromHeader;

    if (!userId) {
      throw new UnauthorizedException('Unauthorized: missing user in request');
    }

    console.log(
      `[PERMISSION GUARD] User ID from JWT: ${userIdFromJwt}, from header: ${userIdFromHeader}, resolved: ${userId}`,
    );

    // 4. Normalize required permission to "module:action" format
    const needed = this.normalizePermission(
      requiredPermission.module,
      requiredPermission.action,
    );

    // 5. Get user permissions from JWT payload (cached)
    let userPermissions: string[] = user.permissions || [];

    // 6. If permissions not in JWT, load from database (fallback)
    if (!userPermissions || userPermissions.length === 0) {
      console.warn(
        `Permissions not found in JWT for user ${userId}, loading from database`,
      );
      userPermissions = await this.loadPermissionsFromDatabase(
        userId,
        user.roleId,
      );
    }

    // 7. Check if user has wildcard permission (Super Admin)
    if (userPermissions.includes('*')) {
      console.log(`✅ Super Admin access granted for ${userId} to ${needed}`);
      return true;
    }

    // 8. Check if user has specific permission
    if (userPermissions.includes(needed)) {
      console.log(`✅ Permission granted: ${userId} has ${needed}`);
      return true;
    }

    // 9. Special-case: allow the delegator (resource owner) to approve their own
    // workflow/delegation even if their role lacks the generic approve permission.
    // THIS CHECK HAPPENS FIRST before throwing error
    if (
      needed === 'document-signatures:approve' ||
      needed === 'workflows:approve'
    ) {
      try {
        const params = request.params || {};
        const resourceId =
          params.id || params.workflowId || params.delegationId;
        console.log(
          `[PERMISSION GUARD] Ownership check: extracted resourceId =`,
          resourceId,
        );
        console.log(`[PERMISSION GUARD] Request params:`, params);
        console.log(`[PERMISSION GUARD] Needed permission:`, needed);
        if (resourceId) {
          console.log(
            `[PERMISSION GUARD] Querying delegations table for id: ${resourceId}`,
          );
          const q = await this.databaseService.query(
            `SELECT id, delegator_id FROM delegations WHERE id = $1`,
            [resourceId],
          );
          console.log(
            `[PERMISSION GUARD] DB query result for id`,
            resourceId,
            ':',
            q.rows,
          );
          if (q.rows && q.rows.length > 0) {
            const owner = String(q.rows[0].delegator_id).trim().toLowerCase();
            const currentUser = String(userId).trim().toLowerCase();
            console.log(
              `[PERMISSION GUARD] DB delegator_id (normalized): "${owner}", Current user (normalized): "${currentUser}"`,
            );
            console.log(
              `[PERMISSION GUARD] Raw delegator_id: "${q.rows[0].delegator_id}", Raw userId: "${userId}"`,
            );
            if (owner === currentUser) {
              console.log(
                `✅ Permission granted by ownership: user ${userId} is delegator of ${resourceId}`,
              );
              return true;
            } else {
              console.warn(
                `[PERMISSION GUARD] Ownership check failed: user ${currentUser} is NOT delegator of ${owner}`,
              );
            }
          } else {
            console.warn(
              `[PERMISSION GUARD] No delegation found for id`,
              resourceId,
            );
          }
        }
      } catch (err) {
        console.error('Permission guard ownership check error:', err);
      }
    }

    // 10. Permission denied
    console.warn(
      `❌ Permission denied: user ${userId} (role: ${user.role}) requires ${needed}`,
    );
    console.warn(`   User permissions: [${userPermissions.join(', ')}]`);

    throw new ForbiddenException({
      statusCode: 403,
      message:
        'Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ với quản trị viên.',
      error: 'Forbidden',
      required: needed,
      userRole: user.role,
      userPermissions: userPermissions.slice(0, 10), // Show first 10 permissions
    });
  }

  /**
   * Normalize permission to lowercase "module:action" format
   */
  private normalizePermission(module: string, action: string): string {
    return `${String(module || '').toLowerCase()}:${String(action || '').toLowerCase()}`;
  }

  /**
   * Load permissions from database (fallback if not in JWT)
   * This should rarely be called - permissions should be in JWT
   */
  private async loadPermissionsFromDatabase(
    userId: string | number,
    roleId: string | number | null,
  ): Promise<string[]> {
    const permissions: string[] = [];

    if (!roleId) {
      return permissions;
    }

    try {
      type PermissionRow = {
        module: string;
        can_create: boolean;
        can_read: boolean;
        can_update: boolean;
        can_delete: boolean;
        can_approve?: boolean | null;
        role_name?: string | null;
      };

      // Try legacy schema (with status & can_approve)
      let rows: PermissionRow[] = [];
      try {
        const res = await this.databaseService.query<PermissionRow>(
          `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete, rp.can_approve,
                  r.name as role_name
           FROM role_permissions rp
           JOIN roles r ON rp.role_id = r.id
           WHERE rp.role_id = $1 AND (r.status = 'active' OR r.status IS NULL)`,
          [roleId as any],
        );
        rows = res.rows;
      } catch {
        // CK schema (no status, no can_approve)
        const res = await this.databaseService.query<PermissionRow>(
          `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete,
                  r.name as role_name
           FROM role_permissions rp
           JOIN roles r ON rp.role_id = r.id
           WHERE rp.role_id = $1`,
          [roleId as any],
        );
        rows = res.rows.map((r) => ({ ...r, can_approve: false }));
      }

      // Module alias map to satisfy existing controllers
      const normalizeModule = (m: string) => {
        const mm = String(m || '')
          .toLowerCase()
          .replace(/\s+/g, '_');
        // Return module name as-is to match role_permissions table
        return mm;
      };

      rows.forEach((row) => {
        const rawModule = String(row.module || '');
        const module = normalizeModule(rawModule);
        if (row.can_create) permissions.push(`${module}:create`);
        if (row.can_read) permissions.push(`${module}:read`);
        if (row.can_update) permissions.push(`${module}:update`);
        if (row.can_delete) permissions.push(`${module}:delete`);
        if (row.can_approve) permissions.push(`${module}:approve`);

        // Special case: CK uses module 'approve' instead of can_approve column
        if (rawModule.toLowerCase() === 'approve') {
          if (row.can_read || row.can_update || row.can_create) {
            permissions.push('document-signatures:approve');
          }
        }
      });

      // Admin/Super Admin wildcard
      if (rows.length > 0) {
        const roleName = (rows[0].role_name || '').toLowerCase();
        if (roleName === 'super admin' || roleName === 'admin') {
          permissions.push('*');
        }
      }
    } catch (error) {
      console.error('Error loading permissions from database:', error);
    }

    return permissions;
  }
}
