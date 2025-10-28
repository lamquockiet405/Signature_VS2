import { DatabaseService } from '../../database/database.service';

/**
 * Helper function to create log entries compatible with CK schema
 *
 * CK logs table schema:
 * - id (SERIAL)
 * - user_id (INTEGER)
 * - action (VARCHAR) - e.g., 'FILE_UPLOAD', 'USER_CREATE'
 * - module (VARCHAR) - e.g., 'files', 'users'
 * - description (TEXT) - Human-readable description
 * - ip_address (VARCHAR)
 * - user_agent (TEXT)
 * - metadata (JSONB) - Additional structured data
 * - created_at (TIMESTAMP)
 */
export class LogHelper {
  /**
   * Create a log entry in the database
   *
   * @param databaseService - Database service instance
   * @param params - Log parameters
   * @returns Promise<void>
   */
  static async createLog(
    databaseService: DatabaseService,
    params: {
      userId?: number | string;
      action: string;
      module: string;
      description: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO logs (user_id, action, details, ip_address, user_agent, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          params.userId ?? null,
          params.action,
          params.description,
          params.ipAddress || null,
          params.userAgent || null,
          'success',
        ],
      );
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to create log entry:', error);
    }
  }

  /**
   * Create a log entry with legacy field mapping
   * Maps old fields (target, target_id, details) to new schema
   *
   * @deprecated Use createLog instead
   */
  static async createLogLegacy(
    databaseService: DatabaseService,
    params: {
      userId: number | string;
      action: string;
      target?: string;
      targetId?: string | number;
      details?: string;
    },
  ): Promise<void> {
    // Map legacy fields to new schema
    const module = params.action.split('_')[0].toLowerCase(); // e.g., 'FILE_UPLOAD' -> 'files'
    const description =
      params.details || `${params.action} on ${params.target}`;
    const metadata = {
      target: params.target,
      targetId: params.targetId,
    };

    await this.createLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module,
      description,
      metadata,
    });
  }
}
