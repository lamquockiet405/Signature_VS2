/**
 * Global type definitions
 * Common types used across the application
 */

declare global {
  /**
   * Generic API Response structure
   */
  interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    timestamp?: string;
  }

  /**
   * Pagination metadata
   */
  interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }

  /**
   * Paginated response
   */
  interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
  }

  /**
   * User context from JWT
   */
  interface UserContext {
    id: string;
    userId?: string;
    username: string;
    email: string;
    role?: string;
    permissions?: string[];
  }

  /**
   * Database query result
   */
  interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
    command: string;
    fields?: any[];
  }

  /**
   * Audit log entry
   */
  interface AuditLog {
    id?: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: Date;
  }

  /**
   * File metadata
   */
  interface FileMetadata {
    id?: string;
    originalFilename: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    userId: string;
    status?: 'pending' | 'signed' | 'deleted';
    createdAt?: Date;
    updatedAt?: Date;
  }
}

export {};
