/**
 * Database schema type definitions for Kysely
 * Defines all tables and their columns
 */

import {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';

// ============================================
// TABLE: users
// ============================================
export interface UsersTable {
  id: Generated<string>;
  username: string;
  email: string;
  password_hash: string;
  role_id: string | null;
  role: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
}

// ============================================
// TABLE: roles
// ============================================
export interface RolesTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
}

// ============================================
// TABLE: role_permissions
// ============================================
export interface RolePermissionsTable {
  id: Generated<string>;
  role_id: string;
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
}

// ============================================
// TABLE: files
// ============================================
export interface FilesTable {
  id: Generated<string>;
  original_filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  user_id: string;
  status: 'pending' | 'signed' | 'deleted';
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
}

// ============================================
// TABLE: digital_signatures
// ============================================
export interface DigitalSignaturesTable {
  id: Generated<string>;
  file_id: string;
  user_id: string;
  signature_data: string;
  signature_hash: string;
  signature_algorithm: string;
  signature_timestamp: Date;
  signed_file_path: string | null;
  verification_status: 'valid' | 'invalid' | 'pending';
  metadata: Record<string, any> | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

// ============================================
// TABLE: workflows
// ============================================
export interface WorkflowsTable {
  id: Generated<string>;
  workflow_type: 'delegation' | 'approval';
  document_id: string;
  delegator_id: string;
  delegate_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'signed' | 'cancelled';
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
  approved_at: Date | null;
  signed_at: Date | null;
}

// ============================================
// TABLE: company
// ============================================
export interface CompanyTable {
  id: Generated<string>;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  tax_code: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
}

// ============================================
// TABLE: delegations
// ============================================
export interface DelegationsTable {
  id: Generated<string>;
  delegator_id: string;
  delegate_id: string;
  start_date: Date;
  end_date: Date;
  status: 'active' | 'inactive' | 'expired';
  scope: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string | Date>;
}

// ============================================
// TABLE: audit_logs
// ============================================
export interface AuditLogsTable {
  id: Generated<string>;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

// ============================================
// TABLE: logs
// ============================================
export interface LogsTable {
  id: Generated<string>;
  user_id: string | null;
  action: string;
  module: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

// ============================================
// DATABASE INTERFACE
// ============================================
export interface Database {
  users: UsersTable;
  roles: RolesTable;
  role_permissions: RolePermissionsTable;
  files: FilesTable;
  digital_signatures: DigitalSignaturesTable;
  workflows: WorkflowsTable;
  company: CompanyTable;
  delegations: DelegationsTable;
  audit_logs: AuditLogsTable;
  logs: LogsTable;
}

// ============================================
// HELPER TYPES FOR CRUD OPERATIONS
// ============================================

// Insert types (for creating new records)
export type NewUser = Insertable<UsersTable>;
export type NewRole = Insertable<RolesTable>;
export type NewRolePermission = Insertable<RolePermissionsTable>;
export type NewFile = Insertable<FilesTable>;
export type NewDigitalSignature = Insertable<DigitalSignaturesTable>;
export type NewWorkflow = Insertable<WorkflowsTable>;
export type NewCompany = Insertable<CompanyTable>;
export type NewDelegation = Insertable<DelegationsTable>;
export type NewAuditLog = Insertable<AuditLogsTable>;
export type NewLog = Insertable<LogsTable>;

// Select types (for reading records)
export type User = Selectable<UsersTable>;
export type Role = Selectable<RolesTable>;
export type RolePermission = Selectable<RolePermissionsTable>;
export type File = Selectable<FilesTable>;
export type DigitalSignature = Selectable<DigitalSignaturesTable>;
export type Workflow = Selectable<WorkflowsTable>;
export type Company = Selectable<CompanyTable>;
export type Delegation = Selectable<DelegationsTable>;
export type AuditLog = Selectable<AuditLogsTable>;
export type Log = Selectable<LogsTable>;

// Update types (for updating records)
export type UserUpdate = Updateable<UsersTable>;
export type RoleUpdate = Updateable<RolesTable>;
export type RolePermissionUpdate = Updateable<RolePermissionsTable>;
export type FileUpdate = Updateable<FilesTable>;
export type DigitalSignatureUpdate = Updateable<DigitalSignaturesTable>;
export type WorkflowUpdate = Updateable<WorkflowsTable>;
export type CompanyUpdate = Updateable<CompanyTable>;
export type DelegationUpdate = Updateable<DelegationsTable>;
export type AuditLogUpdate = Updateable<AuditLogsTable>;
export type LogUpdate = Updateable<LogsTable>;
