import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentManagementService } from '../services/documents.service';
import { DatabaseService } from '../../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { UploadFileDto } from '../dtos/upload-file.dto';
import { CreateDelegationDto } from '../dtos/create-delegation.dto';
import { UpdateDelegationDto } from '../dtos/update-delegation.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/permissions.decorator';
import { UserId } from '../../../common/decorators/user-id.decorator';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

/**
 * DocumentManagement Controller
 * Consolidated controller combining:
 * - Document Signatures (signature delegations and workflows)
 * - Documents (document CRUD operations)
 * - Files (file upload, download, and management)
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentManagementController {
  constructor(
    private readonly documentManagementService: DocumentManagementService,
    private readonly databaseService: DatabaseService,
  ) {}

  // ========================================
  // DOCUMENT SIGNATURES ROUTES
  // Base path: /api/document-signatures
  // ========================================

  @Get('api/document-signatures/roles')
  async getSignatureRoles() {
    return this.documentManagementService.getSignatureRoles();
  }

  @Get('api/document-signatures/stats/summary')
  async getSignatureStats(@Query('period') period?: string) {
    return this.documentManagementService.getSignatureStats(period);
  }

  @Post('api/document-signatures')
  @RequirePermission('document-signatures', 'create')
  async createSignature(
    @Body() createData: CreateDelegationDto & { signature_type?: string },
    @Headers('x-user-id') currentUserId: string,
  ) {
    return this.documentManagementService.createSignature(
      createData,
      currentUserId,
    );
  }

  @Get('api/document-signatures')
  async findAllSignatures(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    const pageNum = parseInt(page || '1') || 1;
    const limitNum = parseInt(limit || '1000') || 1000;
    return this.documentManagementService.findAllSignatures(
      pageNum,
      limitNum,
      filters,
    );
  }

  @Get('api/document-signatures/find-by-document/:documentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  async findDelegationByDocument(@Param('documentId') documentId: string, @Headers('x-user-id') currentUserId: string) {
    try {
      console.log('🔍 Looking for delegation by document ID:', documentId);
      console.log('🔍 User ID:', currentUserId);

      // Try to find delegation by document_id
      const delegationResult = await this.databaseService.query(
        `SELECT d.*, 
                u1.username as delegator_username, u1.full_name as delegator_name,
                u2.username as delegate_username, u2.full_name as delegate_name
         FROM delegations d
         LEFT JOIN users u1 ON d.delegator_id = u1.id
         LEFT JOIN users u2 ON d.delegate_id = u2.id
         WHERE d.document_id = $1 AND d.delegate_id = $2`,
        [documentId, currentUserId],
      );

      if (delegationResult.rows.length > 0) {
        return {
          success: true,
          found: true,
          delegation: delegationResult.rows[0],
          message: 'Delegation found by document_id'
        };
      }

      // If no delegation found, create a new one automatically
      console.log('🔧 No delegation found, creating new delegation for document:', documentId);
      
      const newDelegationId = uuidv4();
      const createResult = await this.databaseService.query(
        `INSERT INTO delegations (id, delegator_id, delegate_id, document_id, status, permissions, reason, created_at, expired_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
         RETURNING *`,
        [
          newDelegationId,
          currentUserId, // delegator_id = current user
          currentUserId, // delegate_id = current user (self-delegation)
          documentId,
          'active',
          JSON.stringify({ workflow_type: 'delegation' }),
          'Auto-created delegation for document signing',
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // expires in 24 hours
        ],
      );

      if (createResult.rows.length > 0) {
        return {
          success: true,
          found: true,
          delegation: createResult.rows[0],
          message: 'Auto-created delegation for document',
          autoCreated: true
        };
      }

      return {
        success: false,
        found: false,
        message: 'No delegation found and failed to create new one',
        documentId,
        userId: currentUserId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        documentId,
        userId: currentUserId
      };
    }
  }


  @Get('api/document-signatures/debug/:id')
  async debugDelegation(@Param('id') id: string, @Headers('x-user-id') currentUserId: string) {
    try {
      console.log('🔍 DEBUG: Looking for delegation with ID:', id);
      console.log('🔍 DEBUG: User ID:', currentUserId);

      // Try to find delegation by ID
      const delegationResult = await this.databaseService.query(
        `SELECT d.*, 
                u1.username as delegator_username, u1.full_name as delegator_name,
                u2.username as delegate_username, u2.full_name as delegate_name
         FROM delegations d
         LEFT JOIN users u1 ON d.delegator_id = u1.id
         LEFT JOIN users u2 ON d.delegate_id = u2.id
         WHERE d.id = $1`,
        [id],
      );

      if (delegationResult.rows.length > 0) {
        return {
          success: true,
          found: true,
          delegation: delegationResult.rows[0],
          message: 'Delegation found by ID'
        };
      }

      // Try to find by document_id (if column exists)
      try {
        const docResult = await this.databaseService.query(
          `SELECT d.*, 
                  u1.username as delegator_username, u1.full_name as delegator_name,
                  u2.username as delegate_username, u2.full_name as delegate_name
           FROM delegations d
           LEFT JOIN users u1 ON d.delegator_id = u1.id
           LEFT JOIN users u2 ON d.delegate_id = u2.id
           WHERE d.document_id = $1 AND d.delegate_id = $2`,
          [id, currentUserId],
        );

        if (docResult.rows.length > 0) {
          return {
            success: true,
            found: true,
            delegation: docResult.rows[0],
            message: 'Delegation found by document_id'
          };
        }
      } catch (error) {
        console.log('❌ document_id column may not exist:', error.message);
      }

      return {
        success: false,
        found: false,
        message: 'No delegation found',
        searchedId: id,
        userId: currentUserId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        searchedId: id,
        userId: currentUserId
      };
    }
  }

  @Put('api/document-signatures/:id/sign')
  // No permission check needed - business logic validates delegate_id
  async signDocument(
    @Param('id') id: string,
    @Body() signData: any,
    @Headers('x-user-id') currentUserId: string,
  ) {
    return this.documentManagementService.signDocument(
      id,
      signData,
      currentUserId,
    );
  }

  @Post('api/documents/:documentId/sign-direct')
  @RequirePermission('document-signatures', 'create')
  async signDocumentDirect(
    @Param('documentId') documentId: string,
    @Body() signData: { totpToken: string; metadata?: any },
    @Headers('x-user-id') currentUserId: string,
  ) {
    return this.documentManagementService.signDocumentDirect(
      documentId,
      signData,
      currentUserId,
    );
  }

  @Put('api/document-signatures/:id/reject')
  @RequirePermission('document-signatures', 'update')
  async rejectSignature(
    @Param('id') id: string,
    @Body() rejectData: { delegate_id: string; reason: string },
    @Headers('x-user-id') currentUserId: string,
  ) {
    return this.documentManagementService.rejectSignature(
      id,
      rejectData.reason,
      currentUserId,
    );
  }

  @Get('api/document-signatures/:id')
  async findOneSignature(@Param('id') id: string) {
    return this.documentManagementService.findOneSignature(id);
  }

  @Put('api/document-signatures/:id')
  @RequirePermission('document-signatures', 'update')
  async updateSignature(
    @Param('id') id: string,
    @Body() updateData: UpdateDelegationDto,
    @UserId() currentUserId: string,
  ) {
    return this.documentManagementService.updateSignature(
      id,
      updateData,
      currentUserId,
    );
  }

  @Delete('api/document-signatures/:id')
  @RequirePermission('document-signatures', 'delete')
  async removeSignature(
    @Param('id') id: string,
    @UserId() currentUserId: string,
  ) {
    return this.documentManagementService.removeSignature(id, currentUserId);
  }

  // ========================================
  // DOCUMENTS ROUTES
  // Base path: /documents
  // ========================================

  @Get('documents')
  @RequirePermission('documents', 'read')
  async getDocuments(@Request() req: any) {
    return {
      message: 'Documents list',
      user: req.user.username,
      role: req.user.role,
      data: [
        { id: '1', name: 'Document 1.pdf' },
        { id: '2', name: 'Document 2.pdf' },
      ],
    };
  }

  @Get('documents/:id')
  @RequirePermission('documents', 'read')
  async getDocument(@Param('id') id: string, @Request() req: any) {
    return {
      message: `Document ${id} details`,
      user: req.user.username,
      data: { id, name: `Document ${id}.pdf`, size: '2.5 MB' },
    };
  }

  @Post('documents')
  @RequirePermission('documents', 'create')
  async createDocument(@Body() body: any, @Request() req: any) {
    return {
      message: 'Document created successfully',
      user: req.user.username,
      role: req.user.role,
      data: { id: '3', name: body.name || 'New Document.pdf' },
    };
  }

  @Patch('documents/:id')
  @RequirePermission('documents', 'update')
  async updateDocument(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return {
      message: `Document ${id} updated`,
      user: req.user.username,
      data: { id, name: body.name },
    };
  }

  @Delete('documents/:id')
  @RequirePermission('documents', 'delete')
  async deleteDocument(@Param('id') id: string, @Request() req: any) {
    return {
      message: `Document ${id} deleted`,
      user: req.user.username,
      role: req.user.role,
    };
  }

  // ========================================
  // DOCUMENTS ROUTES
  // Base path: /api/documents
  // ========================================

  @Post('api/documents/upload')
  @RequirePermission('document', 'create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = './uploads';
          try {
            fs.mkdirSync(uploadDir, { recursive: true });
          } catch {
            // Directory creation error handled by Multer
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
  ) {
    return this.documentManagementService.uploadFile(file, uploadFileDto);
  }

  @Get('api/documents')
  @RequirePermission('document', 'read')
  async findAllFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1') || 1;
    const limitNum = parseInt(limit || '1000') || 1000;
    return this.documentManagementService.findAllFiles(pageNum, limitNum);
  }

  @Get('api/documents/:id')
  @RequirePermission('document', 'read')
  async findOneFile(@Param('id') id: string) {
    return this.documentManagementService.findOneFile(id);
  }

  @Put('api/documents/:id')
  @RequirePermission('document', 'update')
  async updateFile(
    @Param('id') id: string,
    @Body() updateData: any,
    @UserId() userId: string,
  ) {
    console.log('📝 Update file endpoint called:', { id, updateData, userId });
    try {
      const result = await this.documentManagementService.updateFile(id, updateData, userId);
      console.log('✅ Update successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
  }

  @Delete('api/documents/:id')
  @RequirePermission('document', 'delete')
  async deleteFile(
    @Param('id') id: string,
    @Body() body: any,
    @UserId() userId: string,
  ) {
    console.log('🗑️ Delete file endpoint called:', { id, userId, body });
    try {
      const result = await this.documentManagementService.deleteFile(id, userId);
      console.log('✅ Delete successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Delete failed:', error);
      throw error;
    }
  }

  @Get('api/documents/:id/download')
  @RequirePermission('document', 'read')
  async downloadFile(
    @Param('id') id: string,
    @Res({ passthrough: true })
    res: {
      set: (headers: Record<string, string | number>) => void;
    },
  ) {
    const info = await this.documentManagementService.getFileForDownload(id);
    const fs = await import('fs');
    const stream = fs.createReadStream(info.path);

    res.set({
      'Content-Type': info.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(
        info.originalName,
      )}"`,
      'Content-Length': info.size,
    });

    return new StreamableFile(stream);
  }
}
