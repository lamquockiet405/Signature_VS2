import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { WorkflowService } from '../services/workflow.service';

@Controller('api/workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowListController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Lấy danh sách workflows với thông tin actions có thể thực hiện
   * GET /api/workflows?type=pending&userId=xxx
   */
  @Get()
  @RequirePermission('document-signatures', 'read')
  async getWorkflowsWithActions(
    @Request() req: any,
    @Query('type') type: 'pending' | 'approved' | 'rejected' | 'all' = 'all',
    @Query('userId') userId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;
      const targetUserId = userId || currentUserId;

      if (!targetUserId) {
        throw new BadRequestException('User ID is required');
      }

      console.log('📋 === GET WORKFLOWS WITH ACTIONS ===');
      console.log('Type:', type);
      console.log('User ID:', targetUserId);
      console.log('Page:', page, 'Limit:', limit);

      // Lấy workflows theo type
      let workflows;
      if (type === 'pending') {
        workflows =
          await this.workflowService.getPendingApprovals(targetUserId);
      } else if (type === 'approved') {
        // Lấy workflows đã approved
        const allWorkflows =
          await this.workflowService.getMyWorkflows(targetUserId);
        workflows = allWorkflows.filter((w) => w.status === 'approved');
      } else if (type === 'rejected') {
        // Lấy workflows đã rejected
        const allWorkflows =
          await this.workflowService.getMyWorkflows(targetUserId);
        workflows = allWorkflows.filter((w) => w.status === 'rejected');
      } else {
        workflows = await this.workflowService.getMyWorkflows(targetUserId);
      }

      // Thêm thông tin actions cho mỗi workflow
      const workflowsWithActions = workflows.map((workflow) => {
        const actions = this.getAvailableActions(workflow, currentUserId);

        return {
          ...workflow,
          availableActions: actions,
          canApprove: actions.includes('approve'),
          canReject: actions.includes('reject'),
          canSign: actions.includes('sign'),
          canView: actions.includes('view'),
        };
      });

      return {
        success: true,
        data: {
          workflows: workflowsWithActions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: workflowsWithActions.length,
          },
          filters: {
            type,
            userId: targetUserId,
          },
        },
      };
    } catch (error) {
      console.error('❌ Get workflows error:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin chi tiết workflow với actions
   * GET /api/workflows/:id/details
   */
  @Get(':id/details')
  @RequirePermission('document-signatures', 'read')
  async getWorkflowDetails(
    @Query('id') workflowId: string,
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      if (!workflowId) {
        throw new BadRequestException('Workflow ID is required');
      }

      console.log('📋 === GET WORKFLOW DETAILS ===');
      console.log('Workflow ID:', workflowId);
      console.log('User ID:', currentUserId);

      const workflow = await this.workflowService.findWorkflowById(workflowId);
      const actions = this.getAvailableActions(workflow, currentUserId);

      return {
        success: true,
        data: {
          workflow: {
            ...workflow,
            availableActions: actions,
            canApprove: actions.includes('approve'),
            canReject: actions.includes('reject'),
            canSign: actions.includes('sign'),
            canView: actions.includes('view'),
          },
        },
      };
    } catch (error) {
      console.error('❌ Get workflow details error:', error);
      throw error;
    }
  }

  /**
   * Xác định các actions có thể thực hiện trên workflow
   */
  private getAvailableActions(workflow: any, currentUserId: string): string[] {
    const actions: string[] = ['view']; // Luôn có thể xem

    // Kiểm tra quyền dựa trên role và status
    const isDelegator = workflow.delegator_id === currentUserId;
    const isDelegate = workflow.delegate_id === currentUserId;
    const status = workflow.status?.toLowerCase();

    // Actions cho delegator (người ủy quyền)
    if (isDelegator) {
      if (status === 'pending_approval') {
        actions.push('approve', 'reject');
      }
    }

    // Actions cho delegate (người được ủy quyền)
    if (isDelegate) {
      if (status === 'pending' || status === 'approved') {
        actions.push('sign');
      }
    }

    // Actions cho admin (có thể làm mọi thứ)
    // TODO: Thêm logic kiểm tra role admin

    return actions;
  }
}
