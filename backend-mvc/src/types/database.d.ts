/**
 * Database-related type definitions
 */

declare global {
  /**
   * User entity from database
   */
  interface UserEntity {
    id: string;
    username: string;
    email: string;
    password_hash: string;
    full_name?: string;
    phone?: string;
    status: 'active' | 'inactive' | 'suspended';
    created_at: Date;
    updated_at: Date;
  }

  /**
   * Role entity from database
   */
  interface RoleEntity {
    id: string;
    name: string;
    description?: string;
    created_at: Date;
    updated_at: Date;
  }

  /**
   * Permission entity from database
   */
  interface PermissionEntity {
    id: string;
    resource: string;
    action: string;
    description?: string;
    created_at: Date;
  }

  /**
   * File entity from database
   */
  interface FileEntity {
    id: string;
    original_filename: string;
    file_path: string;
    file_type: string;
    file_size: number;
    user_id: string;
    status: 'pending' | 'signed' | 'deleted';
    created_at: Date;
    updated_at: Date;
  }

  /**
   * Digital signature entity from database
   */
  interface DigitalSignatureEntity {
    id: string;
    file_id: string;
    user_id: string;
    signature_data: string;
    signature_hash: string;
    signature_algorithm: string;
    signature_timestamp: Date;
    signed_file_path?: string;
    verification_status: 'valid' | 'invalid' | 'pending';
    metadata?: any;
    created_at: Date;
  }

  /**
   * Workflow entity from database
   */
  interface WorkflowEntity {
    id: string;
    workflow_type: 'delegation' | 'approval';
    document_id: string;
    delegator_id: string;
    delegate_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'signed' | 'cancelled';
    reason?: string;
    metadata?: any;
    created_at: Date;
    updated_at: Date;
    approved_at?: Date;
    signed_at?: Date;
  }

  /**
   * Company entity from database
   */
  interface CompanyEntity {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    tax_code?: string;
    created_at: Date;
    updated_at: Date;
  }

  /**
   * Delegation entity from database
   */
  interface DelegationEntity {
    id: string;
    delegator_id: string;
    delegate_id: string;
    start_date: Date;
    end_date: Date;
    status: 'active' | 'inactive' | 'expired';
    scope?: string;
    created_at: Date;
    updated_at: Date;
  }

  /**
   * Audit log entity from database
   */
  interface AuditLogEntity {
    id: string;
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
    created_at: Date;
  }
}

export {};
