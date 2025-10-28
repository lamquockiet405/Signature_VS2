import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  Res,
  Headers,
  HttpCode,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
  Request,
  StreamableFile,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/permissions.decorator';

// Services
import { DigitalSignatureService } from '../services/signature.service';
import { HSMFileSigningService } from '../../hsm/services/hsm-file-signing.service';
import { PdfFixSignatureService } from '../services/pdf-fix-signature.service';
import { PdfSignService } from '../services/pdf-sign.service';
import { WorkflowService } from '../services/workflow.service';

// DTOs
import { SignRequestDto } from '../dtos/sign-request.dto';
import { P12SignPdfRequestDto } from '../dtos/p12-sign-request.dto';
import { FixSignatureDto } from '../dtos/fix-signature.dto';
import {
  HSMFileSigningRequestDto,
  HSMFileSigningResponseDto,
  HSMKeyGenerationDto,
  HSMKeyListDto,
  HSMSignatureListDto,
} from '../../hsm/dtos/hsm-file-signing.dto';
import {
  CreateWorkflowDto,
  WorkflowType,
} from '../dtos/create-workflow.dto';
import { ApproveWorkflowDto } from '../dtos/approve-workflow.dto';

import { diskStorage } from 'multer';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { validatePdfSignature } from '../utils/pdf-utils.js';

/**
 * Signature Controller
 * Consolidated controller combining all signature-related endpoints:
 * - Digital Signature: PDF signing with HSM
 * - HSM File Signing: Direct HSM-based file signing
 * - PDF Workflow: Unified module for PDF operations and workflows
 *   - PDF Fix Signature: PDF signature validation and fixing
 *   - PDF Sign: Additional PDF signing utilities
 *   - Workflow: Delegation and approval workflows
 */
@Controller()
export class SignatureController {
  constructor(
    private readonly digitalSignatureService: DigitalSignatureService,
    private readonly hsmFileSigningService: HSMFileSigningService,
    private readonly pdfFixSignatureService: PdfFixSignatureService,
    private readonly pdfSignService: PdfSignService,
    private readonly workflowService: WorkflowService,
  ) {}

  // ========================================
  // DIGITAL SIGNATURE ROUTES
  // Base path: /api/digital-signature
  // ========================================

  @Post('api/digital-signature/sign')
  @HttpCode(200)
  async signDocument(
    @Body() signRequestDto: SignRequestDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new Error('User ID is required in x-user-id header');
    }

    console.log('🔐 Sign request received:', {
      documentId: signRequestDto.documentId,
      signatureRequestId: signRequestDto.signatureRequestId,
      userId,
    });

    return this.digitalSignatureService.signPdf(signRequestDto, userId);
  }

  @Post('api/digital-signature/sign/pdf')
  @HttpCode(200)
  async signPdfByPath(@Body() body: P12SignPdfRequestDto) {
    return this.digitalSignatureService.signPdfByPath(body);
  }

  @Get('api/digital-signature/verify/:documentId')
  async verifyDocument(@Param('documentId') documentId: string) {
    console.log('🔍 Verify request for document:', documentId);
    return this.digitalSignatureService.verify(documentId);
  }

  @Post('api/digital-signature/verify-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `verify-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async verifyUploadedFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const result = await validatePdfSignature(file.path);

      await fs.unlink(file.path);

      return {
        valid: result.isValid,
        isSigned: result.isSigned,
        message: result.message,
      };
    } catch (error: any) {
      if (file.path) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw new BadRequestException(
        error.message || 'Failed to verify PDF signature',
      );
    }
  }

  @Post('api/digital-signature/upload-and-sign')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `upload-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadAndSign(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Headers('x-user-id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!userId) {
      throw new Error('User ID is required in x-user-id header');
    }

    const signRequestDto: SignRequestDto = {
      documentId: body.documentId || file.filename,
      signatureRequestId: body.signatureRequestId,
      keyId: body.keyId,
      placeholder: body.placeholder,
      metadata: body.metadata ? JSON.parse(body.metadata) : undefined,
    };

    return this.digitalSignatureService.signPdf(signRequestDto, userId);
  }

  @Get('api/digital-signature/download/:id')
  async downloadSignedFile(@Param('id') id: string, @Res() res: Response) {
    return this.digitalSignatureService.downloadSignedPdf(id, res);
  }

  // ========================================
  // HSM FILE SIGNING ROUTES
  // Base path: /api/hsm-file-signing
  // ========================================

  @Post('api/hsm-file-signing/sign')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'create')
  async signFile(
    @Body() signRequest: HSMFileSigningRequestDto,
    @Req() req: any,
  ): Promise<HSMFileSigningResponseDto> {
    try {
      console.log(
        '🔐 [HSM File Signing Controller] Received sign request:',
        signRequest,
      );
      console.log('👤 User:', req.user);

      const result = await this.hsmFileSigningService.signFile({
        fileId: signRequest.fileId,
        userId: req.user.id,
        keyId: signRequest.keyId,
        signerInfo: signRequest.signerInfo,
        metadata: signRequest.metadata,
      });

      console.log('✅ Sign request completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Sign request failed:', error);
      throw new HttpException(
        error.message || 'File signing failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('api/hsm-file-signing/signatures')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'read')
  async getUserSignatures(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<HSMSignatureListDto> {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);

    const result = await this.hsmFileSigningService.getUserSignatures(
      req.user.id,
      pageNum,
      limitNum,
    );

    return result;
  }

  @Get('api/hsm-file-signing/signatures/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'read')
  async getSignatureById(@Param('id') id: string, @Req() req: any) {
    // Return signature details from digital_signatures table
    const result = await this.hsmFileSigningService.downloadSignedFile(
      id,
      req.user.id,
    );
    return {
      id,
      filename: result.filename,
      contentType: result.contentType,
    };
  }

  @Get('api/hsm-file-signing/download/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'read')
  async downloadSignedHsmFile(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.hsmFileSigningService.downloadSignedFile(
      id,
      req.user.id,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Post('api/hsm-file-signing/keys/generate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'create')
  async generateKey(@Body() keyGenDto: HSMKeyGenerationDto, @Req() req: any) {
    try {
      const result = await this.hsmFileSigningService.generateKey(
        { id: req.user.id },
        {
          keyType: keyGenDto.keyType || 'RSA',
          keySize: keyGenDto.keySize || 2048,
          label: keyGenDto.label || `User_${req.user.id}_Key_${Date.now()}`,
          usage: 'sign',
        },
      );

      return {
        success: true,
        message: 'HSM key pair generated successfully',
        keyId: result.keyId,
        publicKey: result.publicKey,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Key generation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('api/hsm-file-signing/keys')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('files', 'read')
  async listKeys(@Req() req: any): Promise<HSMKeyListDto> {
    try {
      const result = await this.hsmFileSigningService.listKeys({
        id: req.user.id,
      });
      return {
        keys: result.keys || [],
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to list keys',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================
  // PDF FIX SIGNATURE ROUTES
  // Base path: /api/pdf-fix-signature
  // ========================================

  @Post('api/pdf-fix-signature/fix')
  async fixPdfSignature(@Body() body: any) {
    return this.pdfFixSignatureService.fixSignature(body);
  }

  // ========================================
  // PDF SIGN ROUTES
  // Base path: /api/pdf-sign
  // ========================================

  @Post('api/pdf-sign/sign')
  async pdfSign(@Body() body: FixSignatureDto) {
    return this.pdfSignService.signPDF(body);
  }

  // ========================================
  // WORKFLOW ROUTES
  // Base path: /api/workflows
  // ========================================

  /**
   * Create new workflow
   * - Delegation: Tự động ký ngay
   * - Approval: Tạo và chờ approve
   */
  @Post('api/workflows')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('document-signatures', 'create')
  async createWorkflow(
    @Body() createWorkflowDto: CreateWorkflowDto,
    @Headers('x-user-id') currentUserId: string,
  ) {
    try {
      console.log('🔄 === CREATE WORKFLOW REQUEST ===');
      console.log('Workflow Type:', createWorkflowDto.workflow_type);
      console.log('Document ID:', createWorkflowDto.document_id);
      console.log('Delegate ID:', createWorkflowDto.delegate_id);
      console.log('Current User:', currentUserId);

      let result;

      if (createWorkflowDto.workflow_type === WorkflowType.DELEGATION) {
        // ========== DELEGATION WORKFLOW ==========
        // Tự động ký ngay khi tạo
        console.log('📝 Processing DELEGATION workflow (auto-sign)...');

        result = await this.workflowService.processDelegation(
          createWorkflowDto,
          currentUserId,
        );

        // Auto-sign immediately
        if (result.shouldAutoSign) {
          console.log('🔐 Auto-signing document...');

          const signingContext = await this.workflowService.buildSigningContext(
            result.workflow.id,
          );

          const signResult = await this.digitalSignatureService.signPdf(
            {
              documentId: signingContext.documentId,
              signatureRequestId: signingContext.workflowId,
              keyId:
                process.env.HSM_DEFAULT_KEY_ID ||
                '9504359e-949d-488f-a3e6-53c149e60bab',
              placeholder: '{{SIGNATURE_PLACEHOLDER}}',
              metadata: signingContext.metadata,
            },
            signingContext.delegateId,
          );

          console.log('✅ Document auto-signed successfully');

          // Update workflow status to 'signed'
          await this.workflowService.markAsSigned(
            result.workflow.id,
            signResult,
          );

          return {
            success: true,
            message:
              'Delegation workflow created and document signed automatically',
            workflow: result.workflow,
            signature: signResult,
            autoSigned: true,
          };
        }
      } else if (createWorkflowDto.workflow_type === WorkflowType.APPROVAL) {
        // ========== APPROVAL WORKFLOW ==========
        // Tạo workflow và chờ approve
        console.log('📋 Processing APPROVAL workflow (needs approval)...');

        result = await this.workflowService.processApproval(
          createWorkflowDto,
          currentUserId,
        );

        console.log(
          '✅ Approval workflow created, waiting for delegate to approve',
        );

        return {
          success: true,
          message:
            'Approval workflow created. Waiting for delegate to approve.',
          workflow: result.workflow,
          autoSigned: false,
          requiresApproval: true,
        };
      } else {
        throw new BadRequestException('Invalid workflow type');
      }
    } catch (error) {
      console.error('❌ Create workflow error:', error);
      throw error;
    }
  }

  /**
   * Approve workflow (chỉ dành cho approval workflow)
   * Sau khi approve, delegate có thể sign
   */
  @Put('api/workflows/:id/approve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async approveWorkflow(
    @Param('id') workflowId: string,
    @Body() approveDto: ApproveWorkflowDto,
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      console.log('✅ === APPROVE WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Approver ID:', currentUserId);
      console.log('Request User:', req.user);

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      // Approve the workflow (updates status to 'approved')
      const workflow = await this.workflowService.approveWorkflow(
        workflowId,
        approveDto,
        currentUserId,
      );

      // If delegate already submitted a signature draft, finalize signing now
      const draft = workflow?.metadata?.signatureDraft;
      if (draft) {
        console.log('🔐 Finalizing drafted signature after approval...');

        const signResult = await this.digitalSignatureService.signPdf(
          {
            documentId: draft.payload.documentId,
            signatureRequestId: workflow.id,
            keyId: draft.payload.keyId,
            placeholder:
              draft.payload.placeholder || '{{SIGNATURE_PLACEHOLDER}}',
            metadata: draft.payload.metadata,
          },
          draft.attemptedBy,
        );

        await this.workflowService.markAsSigned(workflow.id, signResult);

        return {
          success: true,
          message: 'Workflow approved and document signed successfully.',
          workflow: { ...workflow, status: 'signed' },
          signature: signResult,
        };
      }

      return {
        success: true,
        message:
          'Workflow approved successfully. You can now sign the document.',
        workflow,
      };
    } catch (error) {
      console.error('❌ Approve workflow error:', error);
      throw error;
    }
  }

  /**
   * Sign document after approval
   * (hoặc re-sign delegation nếu cần)
   */
  @Put('api/workflows/:id/sign')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async signWorkflow(@Param('id') workflowId: string, @Request() req: any) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      console.log('🔐 === SIGN WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Signer ID:', currentUserId);

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      const signingContext =
        await this.workflowService.buildSigningContext(workflowId);

      // Validate that current user is the delegate
      if (signingContext.delegateId !== currentUserId) {
        throw new BadRequestException(
          'Only the designated delegate can sign this document',
        );
      }

      // If this is an approval workflow waiting for delegator approval,
      // record a signature draft and do NOT call the HSM yet.
      const workflow = await this.workflowService.findWorkflowById(workflowId);

      if (workflow.status === 'pending_approval') {
        const draft = {
          attemptedBy: currentUserId,
          attemptedAt: new Date().toISOString(),
          payload: {
            documentId: signingContext.documentId,
            keyId:
              process.env.HSM_DEFAULT_KEY_ID ||
              '9504359e-949d-488f-a3e6-53c149e60bab',
            placeholder: '{{SIGNATURE_PLACEHOLDER}}',
            metadata: signingContext.metadata,
          },
        };

        await this.workflowService.saveSignatureDraft(workflowId, draft);

        return {
          success: true,
          message:
            'Signature attempt recorded. Waiting for delegator approval before finalizing signature.',
          pendingApproval: true,
        };
      }

      const signResult = await this.digitalSignatureService.signPdf(
        {
          documentId: signingContext.documentId,
          signatureRequestId: signingContext.workflowId,
          keyId:
            process.env.HSM_DEFAULT_KEY_ID ||
            '9504359e-949d-488f-a3e6-53c149e60bab',
          placeholder: '{{SIGNATURE_PLACEHOLDER}}',
          metadata: signingContext.metadata,
        },
        currentUserId,
      );

      // Update workflow status to 'signed'
      await this.workflowService.markAsSigned(workflowId, signResult);

      console.log('✅ Document signed successfully');

      return {
        success: true,
        message: 'Document signed successfully',
        signature: signResult,
      };
    } catch (error) {
      console.error('❌ Sign workflow error:', error);
      throw error;
    }
  }

  /**
   * Reject approval workflow
   */
  @Put('api/workflows/:id/reject')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async rejectWorkflow(
    @Param('id') workflowId: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    try {
      const currentUserId = req.user?.userId || req.user?.id;

      console.log('❌ === REJECT WORKFLOW REQUEST ===');
      console.log('Workflow ID:', workflowId);
      console.log('Rejector ID:', currentUserId);

      if (!currentUserId) {
        throw new BadRequestException('User ID not found in request');
      }

      const workflow = await this.workflowService.rejectWorkflow(
        workflowId,
        reason,
        currentUserId,
      );

      return {
        success: true,
        message: 'Workflow rejected successfully',
        workflow,
      };
    } catch (error) {
      console.error('❌ Reject workflow error:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for current user
   */
  @Get('api/workflows/pending-approvals')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getPendingApprovals(@Headers('x-user-id') currentUserId: string) {
    const workflows =
      await this.workflowService.getPendingApprovals(currentUserId);

    return {
      success: true,
      count: workflows.length,
      workflows,
    };
  }

  /**
   * Get my workflows (created by me)
   */
  @Get('api/workflows/my-workflows')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async getMyWorkflows(@Headers('x-user-id') currentUserId: string) {
    const workflows = await this.workflowService.getMyWorkflows(currentUserId);

    return {
      success: true,
      count: workflows.length,
      workflows,
    };
  }
}
