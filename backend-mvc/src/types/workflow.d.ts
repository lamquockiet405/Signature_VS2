/**
 * Workflow-related type definitions
 */

declare global {
  /**
   * Workflow types
   */
  type WorkflowType = 'delegation' | 'approval';

  /**
   * Workflow status
   */
  type WorkflowStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'signed'
    | 'cancelled';

  /**
   * Workflow creation request
   */
  interface WorkflowCreateRequest {
    workflow_type: WorkflowType;
    document_id: string;
    delegator_id: string;
    delegate_id: string;
    reason?: string;
    metadata?: Record<string, any>;
  }

  /**
   * Workflow approval request
   */
  interface WorkflowApprovalRequest {
    approved: boolean;
    reason?: string;
    metadata?: Record<string, any>;
  }

  /**
   * Workflow signing context
   */
  interface WorkflowSigningContext {
    workflowId: string;
    documentId: string;
    delegateId: string;
    delegatorId: string;
    metadata: {
      name: string;
      reason: string;
      location: string;
      organizationName?: string;
    };
  }

  /**
   * Delegation workflow result
   */
  interface DelegationWorkflowResult {
    workflow: WorkflowEntity;
    shouldAutoSign: boolean;
    message: string;
  }

  /**
   * Approval workflow result
   */
  interface ApprovalWorkflowResult {
    workflow: WorkflowEntity;
    requiresApproval: boolean;
    message: string;
  }
}

export {};

