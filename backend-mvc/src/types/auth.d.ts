/**
 * Authentication and authorization type definitions
 */

declare global {
  /**
   * JWT payload
   */
  interface JWTPayload {
    id: string;
    username: string;
    email: string;
    role?: string;
    permissions?: string[];
    iat?: number;
    exp?: number;
  }

  /**
   * Login credentials
   */
  interface LoginCredentials {
    username: string;
    password: string;
  }

  /**
   * Login response
   */
  interface LoginResponse {
    success: boolean;
    token: string;
    user: {
      id: string;
      username: string;
      email: string;
      fullName?: string;
      role?: string;
    };
    expiresIn?: string;
  }

  /**
   * Register request
   */
  interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }

  /**
   * Register response
   */
  interface RegisterResponse {
    success: boolean;
    message: string;
    userId?: string;
  }

  /**
   * Permission check
   */
  interface PermissionCheck {
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  }

  /**
   * Role with permissions
   */
  interface RoleWithPermissions {
    id: string;
    name: string;
    description?: string;
    permissions: PermissionEntity[];
  }

  /**
   * User with roles
   */
  interface UserWithRoles {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles: RoleEntity[];
    permissions?: PermissionEntity[];
  }
}

export {};

