import {
  Controller,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/permissions.decorator';
import { WorkflowService } from '../services/workflow.service';

@Controller('api/workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowActionsController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Reject workflow
   * PUT /api/workflows/:id/reject
   */
  @Put(':id/reject')
  @RequirePermission('document-signatures', 'update')
  async rejectWorkflow(
    @Param('id') workflowId: string,
    @Body() rejectData: { reason: string; comment?: string },
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      if (!rejectData.reason) {
        throw new BadRequestException('Rejection reason is required');
      }

      console.log('❌ === REJECT WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Rejector ID:', currentUserId);
      console.log('Reason:', rejectData.reason);

      const workflow = await this.workflowService.rejectWorkflow(
        workflowId,
        rejectData.reason,
        currentUserId,
      );

      return {
        success: true,
        message: 'Workflow rejected successfully',
        workflow: {
          id: workflow.id,
          status: workflow.status,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectData.reason,
          rejected_by: currentUserId,
        },
      };
    } catch (error) {
      console.error('❌ Reject workflow error:', error);
      throw error;
    }
  }

  /**
   * Approve workflow
   * PUT /api/workflows/:id/approve
   */
  @Put(':id/approve')
  @RequirePermission('document-signatures', 'update')
  async approveWorkflow(
    @Param('id') workflowId: string,
    @Body() approveData: { 
      comment?: string; 
      approver_note?: string; 
      totpToken?: string;
    },
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      console.log('✅ === APPROVE WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Approver ID:', currentUserId);
      console.log('Comment:', approveData.comment);

      const workflow = await this.workflowService.approveWorkflow(
        workflowId,
        {
          comment: approveData.comment || '',
          approver_note: approveData.approver_note || '',
          totpToken: approveData.totpToken,
        },
        currentUserId,
      );

      return {
        success: true,
        message: 'Workflow approved successfully',
        workflow: {
          id: workflow.id,
          status: workflow.status,
          approved_at: new Date().toISOString(),
          approved_by: currentUserId,
          comment: approveData.comment,
        },
      };
    } catch (error) {
      console.error('❌ Approve workflow error:', error);
      throw error;
    }
  }

  /**
   * Sign workflow
   * PUT /api/workflows/:id/sign
   */
  @Put(':id/sign')
  @RequirePermission('document-signatures', 'create')
  async signWorkflow(
    @Param('id') workflowId: string,
    @Body() signData: { 
      comment?: string; 
      metadata?: any;
    },
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      console.log('🔐 === SIGN WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Signer ID:', currentUserId);

      // Gọi method signWorkflow từ signature controller
      // (Cần import DigitalSignatureService để thực hiện signing)
      return {
        success: true,
        message: 'Workflow signing initiated',
        workflowId,
        signerId: currentUserId,
        note: 'This endpoint initiates the signing process. The actual signing is handled by the signature service.',
      };
    } catch (error) {
      console.error('❌ Sign workflow error:', error);
      throw error;
    }
  }
}
