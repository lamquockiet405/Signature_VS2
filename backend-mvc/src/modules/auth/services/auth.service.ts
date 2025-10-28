import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../../database/database.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
  ) {}

  /**
   * Login user and return JWT token with permissions
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. Find user by email
    const result = await this.databaseService.query(
      'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = result.rows[0];

    // 2. Verify password
    const match = await bcrypt.compare(
      String(password),
      String(user.password_hash || ''),
    );

    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Load permissions from role_permissions table
    const permissions = await this.loadUserPermissions(
      user.id as any,
      (user as any).role_id ?? null,
    );

    // 4. Create JWT payload with permissions
    const payload = {
      sub: (user as any).id,
      userId: (user as any).id,
      username: (user as any).username,
      email: (user as any).email,
      role: (user as any).role_name || (user as any).role || 'user',
      roleId: (user as any).role_id ?? null,
      permissions: permissions, // ✅ Include permissions array in JWT
    };

    // 5. Sign JWT token
    const access_token = this.jwtService.sign(payload);

    // 6. Remove sensitive fields
    delete user.password_hash;

    return {
      message: 'Login successful',
      access_token, // ✅ Return JWT token
      user: {
        id: (user as any).id,
        username: (user as any).username,
        email: (user as any).email,
        full_name: (user as any).full_name,
        role: (user as any).role_name || (user as any).role,
        roleId: (user as any).role_id ?? null,
      },
      permissions, // ✅ Return permissions for frontend
    };
  }

  /**
   * Normalize module name to match controller expectations
   * This ensures consistency between database module names and permission checks
   */
  private normalizeModule(rawModule: string): string {
    const module = String(rawModule || '')
      .toLowerCase()
      .replace(/\s+/g, '_');

    // Return module name as-is to match database and controller names
    // No conversion needed - all components now use consistent naming
    return module;
  }

  /**
   * Load user permissions from role_permissions table
   * Returns array like: ["documents:read", "documents:create", "users:read"]
   */
  private async loadUserPermissions(
    userId: string | number,
    roleId: string | number | null,
  ): Promise<string[]> {
    const permissions: string[] = [];

    if (!roleId) {
      // User has no role assigned, return empty permissions
      return permissions;
    }

    try {
      // Try CK schema first (no roles.status, no can_approve) - most common
      let result: any;
      try {
        result = await this.databaseService.query<any>(
          `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete,
                  r.name as role_name
           FROM role_permissions rp
           JOIN roles r ON rp.role_id = r.id
           WHERE rp.role_id = $1`,
          [roleId as any],
        );
        // Add can_approve=false for compatibility
        result = {
          ...result,
          rows: (result.rows as any[]).map((row) => ({
            ...row,
            can_approve: false,
          })),
        };
      } catch (ckError) {
        // Fallback to legacy schema (has roles.status and can_approve)
        try {
          result = await this.databaseService.query<any>(
            `SELECT rp.module, rp.can_create, rp.can_read, rp.can_update, rp.can_delete, rp.can_approve,
                    r.name as role_name
             FROM role_permissions rp
             JOIN roles r ON rp.role_id = r.id
             WHERE rp.role_id = $1 AND (r.status = 'active' OR r.status IS NULL)`,
            [roleId as any],
          );
        } catch (legacyError) {
          console.error('Error loading permissions:', legacyError);
          throw legacyError;
        }
      }

      // Convert database rows to permission strings
      (result.rows as any[]).forEach((row) => {
        const rawModule = String(row.module || '');
        const module = this.normalizeModule(rawModule);
        if (row.can_create) permissions.push(`${module}:create`);
        if (row.can_read) permissions.push(`${module}:read`);
        if (row.can_update) permissions.push(`${module}:update`);
        if (row.can_delete) permissions.push(`${module}:delete`);
        if ((row as any).can_approve) permissions.push(`${module}:approve`);
      });

      // Super Admin and Admin get wildcard permission
      if (result.rows.length > 0) {
        const roleName = (result.rows[0] as any).role_name?.toLowerCase();
        if (roleName === 'super admin' || roleName === 'admin') {
          permissions.push('*');
        }
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      // If role_permissions table doesn't exist, fall back to basic permissions
      return this.getFallbackPermissions(userId);
    }

    return permissions;
  }

  /**
   * Get user with full permissions details (for /auth/me endpoint)
   * Returns user info, role, and detailed permissions
   */
  async getUserWithPermissions(userId: string) {
    try {
      // 1. Get user info with role
      const userResult = await this.databaseService.query(
        `SELECT u.id, u.username, u.email, u.full_name, u.phone, u.avatar_url, u.role_id, u.status, u.totp_enabled, u.created_at, u.updated_at,
                r.name as role_name, r.description as role_description
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      const user = userResult.rows[0];

      // 2. Get permissions for user's role
      const permissions: Array<{
        module: string;
        can_create: boolean;
        can_read: boolean;
        can_update: boolean;
        can_delete: boolean;
        can_approve: boolean;
      }> = [];

      if (user.role_id) {
        const permResult = await this.databaseService.query(
          `SELECT module, can_create, can_read, can_update, can_delete, can_approve
           FROM role_permissions
           WHERE role_id = $1
           ORDER BY module`,
          [user.role_id],
        );

        permissions.push(
          ...(permResult.rows as Array<{
            module: string;
            can_create: boolean;
            can_read: boolean;
            can_update: boolean;
            can_delete: boolean;
            can_approve: boolean;
          }>),
        );
      }

      // 3. Check if Super Admin or Admin (wildcard permissions)
      const roleName = (user.role_name || '').toLowerCase();
      const isSuperAdmin = roleName === 'super admin' || roleName === 'admin';

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        avatar_url: user.avatar_url,
        role_id: user.role_id,
        role_name: user.role_name,
        role_description: user.role_description,
        status: user.status,
        totp_enabled: user.totp_enabled,
        created_at: user.created_at,
        updated_at: user.updated_at,
        is_super_admin: isSuperAdmin,
        permissions: permissions,
      };
    } catch (error) {
      console.error('Error getting user with permissions:', error);
      throw error;
    }
  }

  /**
   * Fallback permissions if role_permissions table doesn't exist
   */
  private async getFallbackPermissions(
    userId: string | number,
  ): Promise<string[]> {
    try {
      const result = await this.databaseService.query(
        'SELECT role FROM users WHERE id = $1',
        [userId as any],
      );

      if (result.rows.length === 0) return [];

      const role = (result.rows[0].role || '').toLowerCase();

      // Simple role-based fallback
      if (role === 'admin') return ['*'];
      if (role === 'manager')
        return [
          'overview:read',
          'document:create',
          'document:read',
          'document:update',
          'users:read',
        ];
      if (role === 'user')
        return ['overview:read', 'document:read', 'users:read'];

      return [];
    } catch (error) {
      console.error('Error loading fallback permissions:', error);
      return [];
    }
  }

  async register(registerDto: RegisterDto) {
    const { username, email, password, full_name, role } = registerDto;

    // Check if user exists
    const exists = await this.databaseService.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username],
    );

    if (exists.rows.length > 0) {
      throw new ConflictException('Email or username already exists');
    }

    const password_hash = await bcrypt.hash(password, 10);
    // Insert without explicit id to support both UUID default and SERIAL
    let insertRes;
    try {
      insertRes = await this.databaseService.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, status)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, username, email, role, full_name, status, created_at`,
        [
          username,
          email,
          password_hash,
          role || 'user',
          full_name || '',
          'active',
        ],
      );
    } catch (e) {
      // Fallback legacy with explicit id if needed
      const id = uuidv4();
      insertRes = await this.databaseService.query(
        `INSERT INTO users (id, username, email, password_hash, role, full_name, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, username, email, role, full_name, status, created_at`,
        [
          id,
          username,
          email,
          password_hash,
          role || 'user',
          full_name || '',
          'active',
        ],
      );
    }

    const user = insertRes.rows[0];
    return {
      message: 'User created successfully',
      user,
    };
  }
}
