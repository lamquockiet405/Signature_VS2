import { WorkflowType, WorkflowStatus } from '../dtos/create-workflow.dto';

export interface IWorkflow {
  id: string;
  delegator_id: string;
  delegate_id: string;
  document_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at?: Date;
  approved_at?: Date;
  signed_at?: Date;
  rejected_at?: Date;
  start_date?: Date;
  end_date?: Date;
}

export interface ISigningContext {
  workflowId: string;
  documentId: string;
  delegateId: string;
  keyId?: string;
  metadata: {
    name: string;
    email: string;
    reason: string;
    location: string;
    organizationName?: string;
    organizationUnit?: string;
  };
}
