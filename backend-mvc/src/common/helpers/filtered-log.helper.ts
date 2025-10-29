import { DatabaseService } from '../../database/database.service';

/**
 * Filtered Log Helper - Chỉ lưu các log quan trọng liên quan đến file, ủy quyền và ký
 *
 * Các action được phép log:
 * - FILE_*: Tất cả các thao tác với file
 * - DELEGATION_*: Tất cả các thao tác ủy quyền
 * - WORKFLOW_*: Tất cả các thao tác workflow
 * - DOCUMENT_SIGN: Ký tài liệu
 * - TOTP_*: Xác thực TOTP
 */
export class FilteredLogHelper {
  // Danh sách các action được phép log
  private static readonly ALLOWED_ACTIONS = [
    // File operations
    'FILE_UPLOAD',
    'FILE_DOWNLOAD',
    'FILE_DELETE',
    'FILE_UPDATE',
    'FILE_SIGN',

    // Delegation operations
    'DELEGATION_CREATE',
    'DELEGATION_UPDATE',
    'DELEGATION_DELETE',
    'DELEGATION_APPROVE',
    'DELEGATION_REJECT',
    'DELEGATION_CANCEL',

    // Workflow operations
    'WORKFLOW_DELEGATION_CREATE',
    'WORKFLOW_APPROVAL_CREATE',
    'WORKFLOW_APPROVED',
    'WORKFLOW_REJECTED',
    'WORKFLOW_SIGNED',
    'WORKFLOW_CANCELLED',
    'NOTIFICATION_APPROVAL_REQUEST',

    // Document signing
    'DOCUMENT_SIGN',
    'DOCUMENT_APPROVE',
    'DOCUMENT_REJECT',

    // TOTP operations
    'TOTP_SETUP',
    'TOTP_VERIFY',
    'TOTP_ENABLED',

    // HSM operations
    'HSM_SIGN',
    'HSM_VERIFY',
  ];

  // Danh sách các module được phép log
  private static readonly ALLOWED_MODULES = [
    'files',
    'delegations',
    'workflow',
    'signature',
    'totp',
    'hsm',
  ];

  /**
   * Kiểm tra xem action có được phép log không
   */
  private static isActionAllowed(action: string): boolean {
    return this.ALLOWED_ACTIONS.includes(action);
  }

  /**
   * Kiểm tra xem module có được phép log không
   */
  private static isModuleAllowed(module: string): boolean {
    return this.ALLOWED_MODULES.includes(module);
  }

  /**
   * Tạo log entry chỉ cho các action quan trọng
   */
  static async createFilteredLog(
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
  ): Promise<boolean> {
    try {
      // Kiểm tra xem có nên log không
      if (!this.isActionAllowed(params.action)) {
        console.log(
          `🔇 Skipping log for ${params.action} - not in allowed list`,
        );
        return false;
      }

      // Tạo log entry (sử dụng schema thực tế của logs table)
      await databaseService.query(
        `INSERT INTO logs (user_id, action, details, ip_address, user_agent, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          params.userId ?? null,
          params.action,
          params.description || null,
          params.ipAddress || null,
          params.userAgent || null,
          'success',
        ],
      );

      console.log(`✅ Logged: ${params.action}`);
      return true;
    } catch (error) {
      console.error('Failed to create filtered log entry:', error);
      return false;
    }
  }

  /**
   * Tạo log cho file operations
   */
  static async logFileOperation(
    databaseService: DatabaseService,
    params: {
      userId: string | number;
      action:
        | 'FILE_UPLOAD'
        | 'FILE_DOWNLOAD'
        | 'FILE_DELETE'
        | 'FILE_UPDATE'
        | 'FILE_SIGN';
      fileName: string;
      fileId?: string;
      fileSize?: number;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    return this.createFilteredLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module: 'files',
      description: `${params.action.replace('_', ' ')}: ${params.fileName}`,
      metadata: {
        fileName: params.fileName,
        fileId: params.fileId,
        fileSize: params.fileSize,
        ...params.metadata,
      },
    });
  }

  /**
   * Tạo log cho delegation operations
   */
  static async logDelegationOperation(
    databaseService: DatabaseService,
    params: {
      userId: string | number;
      action:
        | 'DELEGATION_CREATE'
        | 'DELEGATION_UPDATE'
        | 'DELEGATION_DELETE'
        | 'DELEGATION_APPROVE'
        | 'DELEGATION_REJECT'
        | 'DELEGATION_CANCEL';
      delegationId: string;
      delegatorName: string;
      delegateName: string;
      documentName?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    return this.createFilteredLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module: 'delegations',
      description: `${params.action.replace('_', ' ')}: ${params.delegatorName} → ${params.delegateName}${params.documentName ? ` (${params.documentName})` : ''}`,
      metadata: {
        delegationId: params.delegationId,
        delegatorName: params.delegatorName,
        delegateName: params.delegateName,
        documentName: params.documentName,
        ...params.metadata,
      },
    });
  }

  /**
   * Tạo log cho workflow operations
   */
  static async logWorkflowOperation(
    databaseService: DatabaseService,
    params: {
      userId: string | number;
      action:
        | 'WORKFLOW_DELEGATION_CREATE'
        | 'WORKFLOW_APPROVAL_CREATE'
        | 'WORKFLOW_APPROVED'
        | 'WORKFLOW_REJECTED'
        | 'WORKFLOW_SIGNED'
        | 'WORKFLOW_CANCELLED'
        | 'NOTIFICATION_APPROVAL_REQUEST';
      workflowId: string;
      workflowType: string;
      documentName?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    return this.createFilteredLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module: 'workflow',
      description: `${params.action.replace('_', ' ')}: ${params.workflowType}${params.documentName ? ` (${params.documentName})` : ''}`,
      metadata: {
        workflowId: params.workflowId,
        workflowType: params.workflowType,
        documentName: params.documentName,
        ...params.metadata,
      },
    });
  }

  /**
   * Tạo log cho document signing
   */
  static async logDocumentSigning(
    databaseService: DatabaseService,
    params: {
      userId: string | number;
      action: 'DOCUMENT_SIGN' | 'DOCUMENT_APPROVE' | 'DOCUMENT_REJECT';
      documentId: string;
      documentName: string;
      signatureMethod?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    return this.createFilteredLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module: 'signature',
      description: `${params.action.replace('_', ' ')}: ${params.documentName}${params.signatureMethod ? ` (${params.signatureMethod})` : ''}`,
      metadata: {
        documentId: params.documentId,
        documentName: params.documentName,
        signatureMethod: params.signatureMethod,
        ...params.metadata,
      },
    });
  }

  /**
   * Tạo log cho TOTP operations
   */
  static async logTotpOperation(
    databaseService: DatabaseService,
    params: {
      userId: string | number;
      action: 'TOTP_SETUP' | 'TOTP_VERIFY' | 'TOTP_ENABLED';
      description?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    return this.createFilteredLog(databaseService, {
      userId: params.userId,
      action: params.action,
      module: 'totp',
      description:
        params.description ||
        `${params.action.replace('_', ' ')} for user ${params.userId}`,
      metadata: {
        ...params.metadata,
      },
    });
  }

  /**
   * Lấy danh sách các action được phép log
   */
  static getAllowedActions(): string[] {
    return [...this.ALLOWED_ACTIONS];
  }

  /**
   * Lấy danh sách các module được phép log
   */
  static getAllowedModules(): string[] {
    return [...this.ALLOWED_MODULES];
  }
}
