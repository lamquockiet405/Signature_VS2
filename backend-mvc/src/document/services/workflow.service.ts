import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FilteredLogHelper } from '../../common/helpers/filtered-log.helper';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateWorkflowDto,
  WorkflowType,
  WorkflowStatus,
} from '../dtos/create-workflow.dto';
import { ApproveWorkflowDto } from '../dtos/approve-workflow.dto';
import { IWorkflow, ISigningContext } from '../interfaces/workflow.interface';
import { TotpService } from '../../auth/services/totp.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: DatabaseService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * Process Delegation Workflow
   * - Delegate có thể ký ngay khi nhận được quyền
   * - Không cần delegator phê duyệt
   */
  async processDelegation(
    workflowDto: CreateWorkflowDto,
    currentUserId: string,
  ): Promise<{ workflow: IWorkflow }> {
    console.log('🔄 Processing DELEGATION workflow...');

    try {
      // 1. Validate users exist
      console.log(
        'Validating users:',
        workflowDto.delegator_id,
        workflowDto.delegate_id,
      );
      await this.validateUsers(
        workflowDto.delegator_id,
        workflowDto.delegate_id,
      );
      console.log('✅ Users validated');

      // 2. Validate document exists
      console.log('Validating document:', workflowDto.document_id);
      await this.validateDocument(workflowDto.document_id);
      console.log('✅ Document validated');

      // 3. Create workflow record with PENDING status (waiting for delegate to sign)
      const workflowId = uuidv4();
      console.log('Creating workflow record with ID:', workflowId);
      const workflow = await this.createWorkflowRecord({
        id: workflowId,
        ...workflowDto,
        status: WorkflowStatus.PENDING, // Waiting for delegate to sign
        created_by: currentUserId,
      });
      console.log('✅ Workflow record created');

      // 4. Log creation
      await FilteredLogHelper.logWorkflowOperation(this.db, {
        userId: currentUserId,
        action: 'WORKFLOW_DELEGATION_CREATE',
        workflowId,
        workflowType: WorkflowType.DELEGATION,
        documentName: workflowDto.document_id,
        metadata: {
          delegatorId: workflowDto.delegator_id,
          delegateId: workflowDto.delegate_id,
          documentId: workflowDto.document_id,
        },
      });

      console.log(
        '✅ Delegation workflow created, waiting for delegate to sign',
      );

      // Return workflow without auto-sign flag
      return {
        workflow,
      };
    } catch (error) {
      console.error('❌ Error in processDelegation:', error);
      throw error;
    }
  }

  /**
   * Process Approval Workflow
   * - Tạo record với status = 'pending_approval'
   * - Gửi thông báo cho approver
   * - Chờ approve() trước khi sign
   */
  async processApproval(
    workflowDto: CreateWorkflowDto,
    currentUserId: string,
  ): Promise<{ workflow: IWorkflow; shouldAutoSign: false }> {
    console.log('📋 Processing APPROVAL workflow...');

    // 1. Validate users exist
    await this.validateUsers(workflowDto.delegator_id, workflowDto.delegate_id);

    // 2. Validate document exists
    await this.validateDocument(workflowDto.document_id);

    // 3. Create workflow record with 'pending_approval' status
    const workflowId = uuidv4();
    const workflow = await this.createWorkflowRecord({
      id: workflowId,
      ...workflowDto,
      status: WorkflowStatus.PENDING_APPROVAL,
      created_by: currentUserId,
    });

    // 4. Send notification to approver (delegate)
    await this.sendApprovalNotification(workflow);

    // 5. Log creation
    await FilteredLogHelper.logWorkflowOperation(this.db, {
      userId: currentUserId,
      action: 'WORKFLOW_APPROVAL_CREATE',
      workflowId,
      workflowType: WorkflowType.APPROVAL,
      documentName: workflowDto.document_id,
      metadata: {
        delegatorId: workflowDto.delegator_id,
        delegateId: workflowDto.delegate_id,
        documentId: workflowDto.document_id,
      },
    });

    console.log('✅ Approval workflow created, waiting for approval');

    // Return without auto-signing
    return {
      workflow,
      shouldAutoSign: false,
    };
  }

  /**
   * Approve workflow and prepare for signing
   * Chỉ dành cho approval workflow
   */
  async approveWorkflow(
    workflowId: string,
    approveDto: ApproveWorkflowDto,
    currentUserId: string,
  ): Promise<IWorkflow> {
    console.log('✅ Approving workflow:', workflowId);

    // 1. Get workflow
    const workflow = await this.findWorkflowById(workflowId);

    // 2. Validate workflow type
    if (workflow.workflow_type !== WorkflowType.APPROVAL) {
      throw new BadRequestException(
        'Only approval workflows can be approved. Delegation workflows auto-sign.',
      );
    }

    // 3. Validate status
    if (workflow.status !== WorkflowStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Workflow cannot be approved in current status: ${workflow.status}`,
      );
    }

    // 4. Validate approver (must be the delegator — the person who gave permission)
    const normalizedDelegator = String(workflow.delegator_id)
      .trim()
      .toLowerCase();
    const normalizedUser = String(currentUserId).trim().toLowerCase();

    if (normalizedDelegator !== normalizedUser) {
      throw new ForbiddenException(
        'Only the delegator (owner) can approve this workflow',
      );
    }

    // 5. Verify TOTP if provided
    if (approveDto.totpToken) {
      console.log('🔐 Verifying TOTP token for approval...');
      const isTotpValid = await this.totpService.verifyTotpForAuth(
        currentUserId,
        approveDto.totpToken,
      );
      if (!isTotpValid) {
        throw new BadRequestException('Invalid TOTP token. Please try again.');
      }
      console.log('✅ TOTP verification successful for approval');
    } else {
      // Check if user has TOTP enabled
      const isTotpEnabled = await this.totpService.isTotpEnabled(currentUserId);
      if (isTotpEnabled) {
        throw new BadRequestException(
          'TOTP authentication required. Please provide totpToken.',
        );
      }
    }

    // 6. Update status to 'approved'
    const updatedWorkflow = await this.db.query<IWorkflow>(
      `UPDATE delegations 
       SET status = $1, 
           approved_at = CURRENT_TIMESTAMP,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{approval}',
             $2::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [
        WorkflowStatus.APPROVED,
        JSON.stringify({
          approvedBy: currentUserId,
          approvedAt: new Date().toISOString(),
          comment: approveDto.comment,
          approverNote: approveDto.approver_note,
        }),
        workflowId,
      ],
    );

    // 6. Log approval
    await FilteredLogHelper.logWorkflowOperation(this.db, {
      userId: currentUserId,
      action: 'WORKFLOW_APPROVED',
      workflowId,
      workflowType: workflow.workflow_type,
      documentName: workflow.document_id,
      metadata: {
        documentId: workflow.document_id,
        comment: approveDto.comment,
      },
    });

    console.log('✅ Workflow approved, ready for signing');

    return updatedWorkflow.rows[0];
  }

  /**
   * Build signing context from workflow
   */
  async buildSigningContext(workflowId: string): Promise<ISigningContext> {
    const workflow = await this.findWorkflowById(workflowId);

    // Get delegate info
    const delegateResult = await this.db.query(
      `SELECT id, username, full_name, email FROM users WHERE id = $1`,
      [workflow.delegate_id],
    );

    if (delegateResult.rows.length === 0) {
      throw new NotFoundException('Delegate user not found');
    }

    const delegate = delegateResult.rows[0];

    // Get company info from database
    const companyResult = await this.db.query(
      'SELECT name FROM company LIMIT 1',
    );
    const companyName =
      companyResult.rows.length > 0
        ? companyResult.rows[0].name
        : 'CHUKI System';

    return {
      workflowId: workflow.id,
      documentId: workflow.document_id,
      delegateId: workflow.delegate_id,
      metadata: {
        name: delegate.full_name || delegate.username,
        email: delegate.email || `${delegate.username}@chuki.vn`,
        reason: workflow.reason || 'Digital Signature',
        location: workflow.metadata?.location || 'Vietnam',
        organizationName: workflow.metadata?.organizationName || companyName,
        organizationUnit:
          workflow.metadata?.organizationUnit || 'Digital Signature',
      },
    };
  }

  /**
   * Mark workflow as signed
   */
  async markAsSigned(
    workflowId: string,
    signatureData: any,
  ): Promise<IWorkflow> {
    const updatedWorkflow = await this.db.query<IWorkflow>(
      `UPDATE delegations 
       SET status = $1, 
           signed_at = CURRENT_TIMESTAMP,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{signature}',
             $2::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [WorkflowStatus.SIGNED, JSON.stringify(signatureData), workflowId],
    );

    if (updatedWorkflow.rows.length === 0) {
      throw new NotFoundException('Workflow not found');
    }

    return updatedWorkflow.rows[0];
  }

  /**
   * Reject workflow (for approval type)
   */
  async rejectWorkflow(
    workflowId: string,
    reason: string,
    currentUserId: string,
  ): Promise<IWorkflow> {
    const workflow = await this.findWorkflowById(workflowId);

    // Validate workflow type
    if (workflow.workflow_type !== WorkflowType.APPROVAL) {
      throw new BadRequestException('Only approval workflows can be rejected');
    }

    // Validate status
    if (workflow.status !== WorkflowStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Workflow cannot be rejected in current status: ${workflow.status}`,
      );
    }

    // Validate rejector (must be the delegate)
    if (workflow.delegate_id !== currentUserId) {
      throw new ForbiddenException(
        'Only the designated delegate can reject this workflow',
      );
    }

    const updatedWorkflow = await this.db.query<IWorkflow>(
      `UPDATE delegations 
       SET status = $1, 
           rejected_at = CURRENT_TIMESTAMP,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{rejection}',
             $2::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [
        WorkflowStatus.REJECTED,
        JSON.stringify({
          rejectedBy: currentUserId,
          rejectedAt: new Date().toISOString(),
          reason,
        }),
        workflowId,
      ],
    );

    await FilteredLogHelper.logWorkflowOperation(this.db, {
      userId: currentUserId,
      action: 'WORKFLOW_REJECTED',
      workflowId,
      workflowType: workflow.workflow_type,
      documentName: workflow.document_id,
      metadata: {
        documentId: workflow.document_id,
        reason,
      },
    });

    return updatedWorkflow.rows[0];
  }

  // ============= HELPER METHODS =============

  private async validateUsers(
    delegatorId: string,
    delegateId: string,
  ): Promise<void> {
    const usersResult = await this.db.query(
      `SELECT id FROM users WHERE id = ANY($1)`,
      [[delegatorId, delegateId]],
    );

    if (usersResult.rows.length !== 2) {
      throw new NotFoundException('One or both users not found');
    }
  }

  private async validateDocument(documentId: string): Promise<void> {
    const docResult = await this.db.query(
      `SELECT id FROM files WHERE id = $1`,
      [documentId],
    );

    if (docResult.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }
  }

  private async createWorkflowRecord(data: any): Promise<IWorkflow> {
    const result = await this.db.query<IWorkflow>(
      `INSERT INTO delegations (
        id, delegator_id, delegate_id, document_id, 
        permissions, reason, status, created_at, 
        expired_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
      RETURNING *`,
      [
        data.id,
        data.delegator_id,
        data.delegate_id,
        data.document_id,
        JSON.stringify({ workflow_type: data.workflow_type }),
        data.reason || 'Digital Signature',
        data.status,
        data.end_date || null,
        JSON.stringify({
          workflow_type: data.workflow_type,
          ...data.metadata,
        }),
      ],
    );

    return result.rows[0];
  }

  private async sendApprovalNotification(workflow: IWorkflow): Promise<void> {
    // TODO: Implement actual notification system (email, push notification, etc.)
    console.log('📧 Sending approval notification to:', workflow.delegate_id);
    console.log('📄 Document:', workflow.document_id);
    console.log('👤 Delegator:', workflow.delegator_id);

    // For now, just log to database
    await FilteredLogHelper.logWorkflowOperation(this.db, {
      userId: workflow.delegate_id,
      action: 'NOTIFICATION_APPROVAL_REQUEST',
      workflowId: workflow.id,
      workflowType: workflow.workflow_type,
      documentName: workflow.document_id,
      metadata: {
        documentId: workflow.document_id,
        delegatorId: workflow.delegator_id,
      },
    });
  }

  // Expose as public so controllers and other modules can enforce status rules
  async findWorkflowById(workflowId: string): Promise<IWorkflow> {
    const result = await this.db.query<IWorkflow>(
      `SELECT d.*, 
              u1.username as delegator_username, u1.full_name as delegator_name,
              u2.username as delegate_username, u2.full_name as delegate_name,
              (metadata->>'workflow_type')::text as workflow_type
       FROM delegations d
       LEFT JOIN users u1 ON d.delegator_id = u1.id
       LEFT JOIN users u2 ON d.delegate_id = u2.id
       WHERE d.id = $1`,
      [workflowId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Workflow not found');
    }

    return result.rows[0];
  }

  /**
   * Save a signature draft into workflow metadata (used for approval flows
   * where delegate signs first and delegator approves later).
   */
  async saveSignatureDraft(workflowId: string, draft: any): Promise<IWorkflow> {
    const updated = await this.db.query<IWorkflow>(
      `UPDATE delegations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({ signatureDraft: draft }), workflowId],
    );

    if (updated.rows.length === 0) {
      throw new NotFoundException('Workflow not found');
    }

    return updated.rows[0];
  }

  /**
   * Get workflows for a user (as delegate - pending approvals)
   */
  async getPendingApprovals(userId: string): Promise<IWorkflow[]> {
    const result = await this.db.query<IWorkflow>(
      `SELECT d.*, 
              u1.username as delegator_username, u1.full_name as delegator_name,
              f.original_name as document_name,
              (metadata->>'workflow_type')::text as workflow_type
       FROM delegations d
       LEFT JOIN users u1 ON d.delegator_id = u1.id
       LEFT JOIN files f ON d.document_id = f.id
       WHERE d.delegate_id = $1 
         AND d.status = $2
       ORDER BY d.created_at DESC`,
      [userId, WorkflowStatus.PENDING_APPROVAL],
    );

    return result.rows;
  }

  /**
   * Get workflows created by user (as delegator)
   */
  async getMyWorkflows(userId: string): Promise<IWorkflow[]> {
    const result = await this.db.query<IWorkflow>(
      `SELECT d.*, 
              u2.username as delegate_username, u2.full_name as delegate_name,
              f.original_name as document_name,
              (metadata->>'workflow_type')::text as workflow_type
       FROM delegations d
       LEFT JOIN users u2 ON d.delegate_id = u2.id
       LEFT JOIN files f ON d.document_id = f.id
       WHERE d.delegator_id = $1
       ORDER BY d.created_at DESC`,
      [userId],
    );

    return result.rows;
  }
}
