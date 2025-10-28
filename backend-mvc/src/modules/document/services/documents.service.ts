import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DelegationsService } from '../services/delegations.service';
import { DigitalSignatureService } from '../services/signature.service';
import { WorkflowService } from '../services/workflow.service';
import { CreateDelegationDto } from '../dtos/create-delegation.dto';
import { UpdateDelegationDto } from '../dtos/update-delegation.dto';
import {
  CreateWorkflowDto,
  WorkflowType,
} from '../dtos/create-workflow.dto';
import { UploadFileDto } from '../dtos/upload-file.dto';
import { FilteredLogHelper } from '../../../common/helpers/filtered-log.helper';
import { v4 as uuidv4 } from 'uuid';
import { TotpService } from '../../auth/services/totp.service';

/**
 * DocumentManagement Service
 * Consolidated service combining business logic for:
 * - Document Signatures (delegations, workflows, signing)
 * - Files (upload, download, management)
 * - Documents (basic document operations)
 */
@Injectable()
export class DocumentManagementService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly delegationsService: DelegationsService,
    private readonly digitalSignatureService: DigitalSignatureService,
    private readonly workflowService: WorkflowService,
    private readonly totpService: TotpService,
  ) {}

  // ========================================
  // DOCUMENT SIGNATURES METHODS
  // ========================================

  async getSignatureRoles() {
    return this.delegationsService.getRoles();
  }

  async getSignatureStats(period?: string) {
    return this.delegationsService.getStats(period);
  }

  async createSignature(
    createData: CreateDelegationDto & { signature_type?: string },
    currentUserId: string,
  ) {
    try {
      console.log('🔄 === CREATE SIGNATURE DELEGATION ===');
      console.log('Signature Type:', createData.signature_type || 'delegation');
      console.log('Document ID:', createData.document_id);

      if (!createData.document_id) {
        throw new BadRequestException('document_id is required');
      }

      // Accept either `signature_type` (legacy) or `workflow_type` (frontend)
      const incomingType =
        (createData as any).signature_type || (createData as any).workflow_type;
      const workflowType =
        incomingType === 'approval'
          ? WorkflowType.APPROVAL
          : WorkflowType.DELEGATION;

      console.log('Mapped to Workflow Type:', workflowType);

      // Ensure delegator is set - for delegation workflows the delegator
      // defaults to the acting user when not supplied by client.
      const delegatorId = createData.delegator_id || currentUserId;

      // Safely convert dates to ISO strings only when they are Date objects.
      const toIsoIfDate = (d: unknown): string | undefined => {
        if (!d) return undefined;
        try {
          if (d instanceof Date) return d.toISOString();
          if (typeof d === 'string') return d;
          // Otherwise, attempt to construct a Date and validate it.
          const parsed = new Date(String(d));
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
        } catch {
          // ignore and return undefined
        }
        return undefined;
      };

      const workflowDto: CreateWorkflowDto = {
        delegator_id: delegatorId,
        delegate_id: createData.delegate_id,
        document_id: createData.document_id,
        workflow_type: workflowType,
        reason: createData.reason,
        start_date: toIsoIfDate(createData.start_date),
        end_date: toIsoIfDate(createData.end_date),
        metadata: {
          signature_type: incomingType || 'delegation',
          permissions: createData.permissions as Record<string, unknown>,
        },
      };

      let result;

      if (workflowType === WorkflowType.DELEGATION) {
        console.log('📝 Creating DELEGATION (waiting for delegate to sign)...');

        result = await this.workflowService.processDelegation(
          workflowDto,
          currentUserId,
        );

        // Log delegation creation
        try {
          await this.databaseService.query(
            `INSERT INTO activity_logs (user_id, action, target, details) 
             VALUES ($1, 'DELEGATION_CREATE', $2, $3)`,
            [
              currentUserId,
              result.workflow.id,
              JSON.stringify({
                workflow_type: 'delegation',
                delegate_id: createData.delegate_id,
                document_id: createData.document_id,
                auto_signed: false,
                requires_delegate_signature: true,
              }),
            ],
          );
        } catch (logError) {
          console.error(
            '⚠️ Failed to log delegation creation (non-critical):',
            logError,
          );
        }

        console.log('✅ Delegation created, waiting for delegate to sign');

        return {
          message:
            'Delegation created. Delegate can now sign the document.',
          signature: result.workflow,
          autoSigned: false,
          requiresSignature: true,
        };
      } else {
        console.log('📋 Creating APPROVAL (needs approval)...');

        result = await this.workflowService.processApproval(
          workflowDto,
          currentUserId,
        );

        console.log(
          '✅ Approval workflow created, waiting for delegate approval',
        );

        // Log approval workflow creation
        try {
          await this.databaseService.query(
            `INSERT INTO activity_logs (user_id, action, target, details) 
             VALUES ($1, 'APPROVAL_CREATE', $2, $3)`,
            [
              currentUserId,
              result.workflow.id,
              JSON.stringify({
                workflow_type: 'approval',
                delegate_id: createData.delegate_id,
                document_id: createData.document_id,
                requires_approval: true,
              }),
            ],
          );
        } catch (logError) {
          console.error(
            '⚠️ Failed to log approval creation (non-critical):',
            logError,
          );
        }

        return {
          message:
            'Approval workflow created. Delegate must approve before signing.',
          signature: result.workflow,
          autoSigned: false,
          requiresApproval: true,
        };
      }
    } catch (error) {
      console.error('❌ Create signature delegation error:', error);
      throw error;
    }
  }

  async findAllSignatures(page: number, limit: number, filters?: any) {
    const result = await this.delegationsService.findAll(page, limit, filters);
    return {
      signatures: result.data || [],
      pagination: result.pagination,
    };
  }

  async findOneSignature(id: string) {
    const delegation = await this.delegationsService.findOne(id);
    return {
      signature: delegation,
    };
  }

  async signDocument(id: string, signData: any, currentUserId: string) {
    try {
      console.log('🔐 === SIGN DOCUMENT REQUEST ===');
      console.log('ID:', id);
      console.log('User ID:', currentUserId);
      console.log('🔍 DEBUG: signData received:', {
        allKeys: Object.keys(signData)
      });

      // Find delegation by ID
      let delegation;
      try {
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
          delegation = delegationResult.rows[0];
          console.log('📄 Found delegation:', delegation.id);
        } else {
          throw new NotFoundException('Delegation not found');
        }
      } catch (error) {
        console.log('❌ Delegation not found:', error.message);
        throw new NotFoundException('Delegation not found');
      }

      console.log('📄 Delegation:', delegation);

      // Validate that current user is the delegate
      if (delegation.delegate_id !== currentUserId) {
        throw new BadRequestException(
          'You are not authorized to sign this document. Only the delegate can sign.',
        );
      }

      // TOTP verification for signing
      if (signData.totpToken) {
        console.log('🔐 Verifying TOTP token for signing...');
        const isTotpValid = await this.totpService.verifyTotpForAuth(currentUserId, signData.totpToken);
        if (!isTotpValid) {
          throw new BadRequestException('Invalid TOTP token. Please enter the correct TOTP code.');
        }
        console.log('✅ TOTP verification successful for signing');
      } else {
        // Check if user has TOTP enabled - if yes, require TOTP
        const isTotpEnabled = await this.totpService.isTotpEnabled(currentUserId);
        if (isTotpEnabled) {
          throw new BadRequestException('TOTP authentication required. Please provide totpToken.');
        }
        console.log('⚠️ No TOTP provided - proceeding without TOTP verification (user has TOTP disabled)');
      }

      const disallowedStatuses = ['revoked', 'cancelled', 'expired'];
      if (disallowedStatuses.includes(delegation.status)) {
        throw new BadRequestException(
          `Delegation is not signable in current state: ${delegation.status}`,
        );
      }

      const documentId =
        signData.documentId ||
        delegation.metadata?.documentId ||
        delegation.document_id;

      if (!documentId) {
        throw new BadRequestException(
          'Document ID not found. Please provide documentId in request body or ensure delegation has document_id.',
        );
      }

      console.log('📁 Document ID:', documentId);

      // Get company info from database
      const companyResult = await this.databaseService.query(
        'SELECT name FROM company LIMIT 1',
      );
      const companyName =
        companyResult.rows.length > 0
          ? companyResult.rows[0].name
          : 'CHUKI System';

      const metadata = signData.metadata || {
        name: delegation.delegate_name || 'Unknown Signer',
        email:
          delegation.delegate_email ||
          delegation.metadata?.email ||
          `user${currentUserId}@chuki.vn`,
        reason: delegation.reason || 'Digital signature',
        location: 'Vietnam',
        organizationName: delegation.metadata?.organizationName || companyName,
        organizationUnit:
          delegation.metadata?.organizationUnit || 'Digital Signature',
      };

      console.log('✍️  Signing metadata:', metadata);

      // If delegation is an approval-type (waiting for delegator approval),
      // we should not perform HSM signing immediately. Instead store a
      // signature draft in the delegation's metadata and inform client that
      // the signature is pending delegator approval.
      if (delegation.status === 'pending_approval') {
        const draft = {
          attemptedBy: currentUserId,
          attemptedAt: new Date().toISOString(),
          payload: {
            documentId,
            keyId:
              signData.keyId ||
              process.env.HSM_DEFAULT_KEY_ID ||
              '9504359e-949d-488f-a3e6-53c149e60bab',
            placeholder: signData.placeholder || '{{SIGNATURE_PLACEHOLDER}}',
            metadata,
          },
        };

        await this.delegationsService.update(
          id,
          {
            metadata: { ...(delegation.metadata || {}), signatureDraft: draft },
            status: 'pending_approval',
          } as any,
          currentUserId,
        );

        return {
          message:
            'Signature attempt recorded. Waiting for delegator approval before finalizing signature.',
          pendingApproval: true,
        };
      }

      // Otherwise for delegation flows, perform immediate signing
      const signResult = await this.digitalSignatureService.signPdf(
        {
          documentId,
          signatureRequestId: id,
          keyId:
            signData.keyId ||
            process.env.HSM_DEFAULT_KEY_ID ||
            '9504359e-949d-488f-a3e6-53c149e60bab',
          placeholder: signData.placeholder || '{{SIGNATURE_PLACEHOLDER}}',
          metadata,
        },
        currentUserId,
      );

      console.log('✅ Sign result:', signResult);

      await this.delegationsService.update(
        id,
        {
          status: 'signed' as any,
        },
        currentUserId,
      );

      console.log('✅ Delegation updated to signed');

      // Log document signing
      try {
        await this.databaseService.query(
          `INSERT INTO activity_logs (user_id, action, target, details) 
           VALUES ($1, 'DOCUMENT_SIGN', $2, $3)`,
          [
            currentUserId,
            id,
            JSON.stringify({
              document_id: documentId,
              delegation_id: id,
              signed_at: new Date().toISOString(),
            }),
          ],
        );
      } catch (logError) {
        console.error(
          '⚠️ Failed to log document signing (non-critical):',
          logError,
        );
      }

      return {
        message: 'Document signed successfully',
        signature: signResult,
      };
    } catch (error: any) {
      console.error('❌ Sign error:', error);
      throw error;
    }
  }

  async rejectSignature(id: string, reason: string, currentUserId: string) {
    try {
      console.log('❌ === REJECT SIGNATURE REQUEST ===');
      console.log('Delegation ID:', id);
      console.log('Reason:', reason);
      console.log('User ID:', currentUserId);

      // Get the delegation
      const delegation = await this.delegationsService.findOne(id);

      if (!delegation) {
        throw new NotFoundException('Delegation not found');
      }

      // Update delegation status to rejected
      const updatedDelegation = await this.delegationsService.update(
        id,
        {
          status: 'rejected',
          metadata: {
            ...delegation.metadata,
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUserId,
            rejectionReason: reason,
          },
        } as UpdateDelegationDto,
        currentUserId,
      );

      // Log the rejection
      try {
        await this.databaseService.query(
          `INSERT INTO activity_logs (user_id, action, target, details) 
           VALUES ($1, 'SIGNATURE_REJECT', $2, $3)`,
          [
            currentUserId,
            'document_signature',
            JSON.stringify({
              delegationId: id,
              reason: reason,
              documentId: delegation.document_id,
              documentName: delegation.metadata?.document_name,
            }),
          ],
        );
      } catch (logError) {
        console.error('Failed to log rejection:', logError);
      }

      console.log('✅ Signature rejected successfully');

      return {
        message: 'Signature rejected successfully',
        delegation: updatedDelegation,
      };
    } catch (error: any) {
      console.error('❌ Reject error:', error);
      throw error;
    }
  }

  async updateSignature(
    id: string,
    updateData: UpdateDelegationDto,
    currentUserId: string,
  ) {
    const delegation = await this.delegationsService.update(
      id,
      updateData,
      currentUserId,
    );

    // Log signature update
    try {
      await this.databaseService.query(
        `INSERT INTO activity_logs (user_id, action, target, details) 
         VALUES ($1, 'DELEGATION_UPDATE', $2, $3)`,
        [
          currentUserId,
          id,
          JSON.stringify({
            changes: updateData,
            updated_at: new Date().toISOString(),
          }),
        ],
      );
    } catch (logError) {
      console.error(
        '⚠️ Failed to log delegation update (non-critical):',
        logError,
      );
    }

    return {
      message: 'Signature delegation updated successfully',
      signature: delegation,
    };
  }

  async removeSignature(id: string, currentUserId: string) {
    const delegation = await this.delegationsService.remove(id, currentUserId);

    // Log signature removal/revocation
    try {
      await this.databaseService.query(
        `INSERT INTO activity_logs (user_id, action, target, details) 
         VALUES ($1, 'DELEGATION_REVOKE', $2, $3)`,
        [
          currentUserId,
          id,
          JSON.stringify({
            revoked_at: new Date().toISOString(),
          }),
        ],
      );
    } catch (logError) {
      console.error(
        '⚠️ Failed to log delegation revocation (non-critical):',
        logError,
      );
    }

    return {
      message: 'Signature delegation revoked successfully',
      signature: delegation,
    };
  }

  // ========================================
  // FILES METHODS
  // ========================================

  async uploadFile(file: Express.Multer.File, uploadFileDto: UploadFileDto) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const { description, documentName, userId } = uploadFileDto;
    let uploadedBy: string | number | null = userId ?? null;

    if (!uploadedBy || uploadedBy === '00000000-0000-0000-0000-000000000000') {
      const userResult = await this.databaseService.query(
        'SELECT id FROM users LIMIT 1',
        [],
      );
      if (userResult.rows.length > 0) {
        uploadedBy = (userResult.rows[0] as { id: string }).id;
      }
    }

    const relativePath = file.path.includes('uploads')
      ? `/uploads/${file.filename}`
      : file.path;

    const colInfo = await this.databaseService.query(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_name = 'files' AND column_name IN ('id','uploaded_by')`,
      [],
    );
    const idCol = colInfo.rows.find(
      (r) => (r as { column_name: string }).column_name === 'id',
    ) as { column_name: string; data_type: string } | undefined;
    const uploadedByCol = colInfo.rows.find(
      (r) => (r as { column_name: string }).column_name === 'uploaded_by',
    ) as { column_name: string; data_type: string } | undefined;

    const idIsUuid = idCol?.data_type?.toLowerCase().includes('uuid') ?? false;
    const uploadedByIsInteger = uploadedByCol?.data_type
      ?.toLowerCase()
      .includes('int');
    const uploadedByIsUuid = uploadedByCol?.data_type
      ?.toLowerCase()
      .includes('uuid');

    if (uploadedBy != null) {
      if (uploadedByIsInteger) {
        const n = Number(uploadedBy);
        uploadedBy = Number.isFinite(n) ? n : null;
      } else if (uploadedByIsUuid) {
        const s = String(uploadedBy);
        const uuidLike = /^[0-9a-fA-F-]{36}$/.test(s);
        uploadedBy = uuidLike ? s : null;
      }
    }

    const fileData = {
      id: idIsUuid ? uuidv4() : undefined,
      filename: file.filename,
      original_name: documentName || file.originalname,
      path: relativePath,
      size: file.size,
      mime_type: file.mimetype,
      uploaded_by: uploadedBy,
      description: description || null,
    } as {
      id?: string;
      filename: string;
      original_name: string;
      path: string;
      size: number;
      mime_type: string;
      uploaded_by: string | number | null;
      description: string | null;
    };

    let result;
    try {
      if (uploadedBy != null && idIsUuid) {
        result = await this.databaseService.query(
          `INSERT INTO files (id, filename, original_name, path, size, mime_type, uploaded_by, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            fileData.id,
            fileData.filename,
            fileData.original_name,
            fileData.path,
            fileData.size,
            fileData.mime_type,
            fileData.uploaded_by,
            fileData.description,
          ],
        );
      } else if (uploadedBy != null && !idIsUuid) {
        result = await this.databaseService.query(
          `INSERT INTO files (filename, original_name, path, size, mime_type, uploaded_by, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            fileData.filename,
            fileData.original_name,
            fileData.path,
            fileData.size,
            fileData.mime_type,
            fileData.uploaded_by,
            fileData.description,
          ],
        );
      } else if (idIsUuid) {
        result = await this.databaseService.query(
          `INSERT INTO files (id, filename, original_name, path, size, mime_type, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            fileData.id,
            fileData.filename,
            fileData.original_name,
            fileData.path,
            fileData.size,
            fileData.mime_type,
            fileData.description,
          ],
        );
      } else {
        result = await this.databaseService.query(
          `INSERT INTO files (filename, original_name, path, size, mime_type, description)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            fileData.filename,
            fileData.original_name,
            fileData.path,
            fileData.size,
            fileData.mime_type,
            fileData.description,
          ],
        );
      }
    } catch {
      result = await this.databaseService.query(
        `INSERT INTO files (filename, original_name, path, size, mime_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          file.filename,
          documentName || file.originalname,
          relativePath,
          file.size,
          file.mimetype,
        ],
      );
    }

    type InsertRow = { id?: string | number } & Record<string, unknown>;
    const insertedRows: InsertRow[] = (
      result as unknown as {
        rows: InsertRow[];
      }
    ).rows;

    if (uploadedBy != null) {
      await FilteredLogHelper.logFileOperation(this.databaseService, {
        userId: uploadedBy,
        action: 'FILE_UPLOAD',
        fileName: fileData.original_name,
        fileId: insertedRows[0]?.id?.toString(),
        fileSize: fileData.size,
        metadata: {
          filename: fileData.filename,
          mimeType: fileData.mime_type,
        },
      });
    }

    return {
      message: 'File uploaded successfully',
      file: insertedRows[0],
    };
  }

  async findAllFiles(page: number = 1, limit: number = 1000) {
    const offset = (page - 1) * limit;

    const cols = await this.databaseService.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'files' AND column_name IN ('created_at','uploaded_by')`,
      [],
    );
    const hasCreatedAt = cols.rows.some(
      (r) => (r as { column_name: string }).column_name === 'created_at',
    );
    const hasUploadedBy = cols.rows.some(
      (r) => (r as { column_name: string }).column_name === 'uploaded_by',
    );

    const selectJoin = hasUploadedBy
      ? `SELECT f.*, u.username, u.full_name, COALESCE(u.full_name, u.username) as uploader_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id`
      : `SELECT f.* FROM files f`;
    const orderBy = hasCreatedAt
      ? `ORDER BY f.created_at DESC NULLS LAST, f.id DESC`
      : `ORDER BY f.id DESC`;

    const result = await this.databaseService.query(
      `${selectJoin} ${orderBy} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const countResult = await this.databaseService.query(
      'SELECT COUNT(*) FROM files',
      [],
    );
    const total = parseInt(
      String(
        (countResult as unknown as { rows: Array<{ count: string | number }> })
          .rows[0].count,
      ),
      10,
    );

    return {
      files: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneFile(id: string) {
    const cols = await this.databaseService.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'files' AND column_name = 'uploaded_by'`,
      [],
    );
    const hasUploadedBy = cols.rows.length > 0;

    const base = hasUploadedBy
      ? `SELECT f.*, u.username, u.full_name, COALESCE(u.full_name, u.username) as uploader_name FROM files f LEFT JOIN users u ON f.uploaded_by = u.id`
      : `SELECT f.* FROM files f`;

    const result = await this.databaseService.query(`${base} WHERE f.id = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      throw new NotFoundException('File not found');
    }

    return result.rows[0];
  }

  async updateFile(id: string, updateData: any, userId: string) {
    console.log('🔧 updateFile service called:', { id, updateData, userId });

    try {
      // Check if file exists
      const fileExists = await this.databaseService.query(
        'SELECT * FROM files WHERE id = $1',
        [id],
      );

      console.log('📄 File exists check:', fileExists.rows.length > 0);

      if (fileExists.rows.length === 0) {
        throw new NotFoundException('File not found');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (updateData.original_name) {
        updates.push(`original_name = $${paramCount}`);
        params.push(updateData.original_name);
        paramCount++;
      }

      if (updateData.status) {
        updates.push(`status = $${paramCount}`);
        params.push(updateData.status);
        paramCount++;
      }

      if (updateData.description !== undefined) {
        updates.push(`description = $${paramCount}`);
        params.push(updateData.description);
        paramCount++;
      }

      console.log('📝 Updates to apply:', updates);

      if (updates.length === 0) {
        throw new BadRequestException('No fields to update');
      }

      // Check if updated_at column exists
      const hasUpdatedAt = await this.databaseService.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'files' AND column_name = 'updated_at'`,
        [],
      );

      if (hasUpdatedAt.rows.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
      }

      params.push(id);

      const query = `
        UPDATE files
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      console.log('🔍 SQL Query:', query);
      console.log('🔍 SQL Params:', params);

      const result = await this.databaseService.query(query, params);

      console.log('✅ Update result:', result.rows[0]);

      // Log the update action
      try {
        await this.databaseService.query(
          `INSERT INTO activity_logs (user_id, action, target, details) 
           VALUES ($1, 'FILE_UPDATE', $2, $3)`,
          [
            userId,
            id,
            JSON.stringify({
              filename: result.rows[0].original_name,
              changes: updateData,
            }),
          ],
        );
      } catch (logError) {
        console.error('⚠️ Failed to log activity (non-critical):', logError);
      }

      return {
        message: 'File updated successfully',
        file: result.rows[0],
      };
    } catch (error) {
      console.error('❌ Error in updateFile service:', error);
      throw error;
    }
  }

  async deleteFile(id: string, userId: string) {
    console.log('🗑️ deleteFile service called:', { id, userId });

    try {
      // Check if file exists
      const fileExists = await this.databaseService.query(
        'SELECT * FROM files WHERE id = $1',
        [id],
      );

      console.log('📄 File exists check:', fileExists.rows.length > 0);

      if (fileExists.rows.length === 0) {
        throw new NotFoundException('File not found');
      }

      const file = fileExists.rows[0];
      console.log('📂 File to delete:', {
        id: file.id,
        name: file.original_name || file.filename,
        path: file.path,
      });

      // Delete file from filesystem if exists
      if (file.path) {
        try {
          const fs = await import('fs');
          const path = (file.path as string) || '';
          const isRelative = path.startsWith('/uploads/');
          const resolvedPath = isRelative ? `.${path}` : path;

          console.log('🔍 Checking file path:', resolvedPath);

          if (fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath);
            console.log('✅ Physical file deleted');
          } else {
            console.log('⚠️ Physical file not found, skipping');
          }
        } catch (fsError) {
          console.error(
            '⚠️ Failed to delete physical file (non-critical):',
            fsError,
          );
        }
      }

      // Delete from database
      console.log('🗄️ Deleting from database...');
      await this.databaseService.query('DELETE FROM files WHERE id = $1', [id]);
      console.log('✅ Database record deleted');

      // Log the delete action
      try {
        await this.databaseService.query(
          `INSERT INTO activity_logs (user_id, action, target, details) 
           VALUES ($1, 'FILE_DELETE', $2, $3)`,
          [
            userId,
            id,
            JSON.stringify({
              filename: file.original_name || file.filename,
            }),
          ],
        );
        console.log('✅ Activity logged');
      } catch (logError) {
        console.error('⚠️ Failed to log activity (non-critical):', logError);
      }

      return {
        message: 'File deleted successfully',
        fileId: id,
      };
    } catch (error) {
      console.error('❌ Error in deleteFile service:', error);
      throw error;
    }
  }

  async getFileForDownload(id: string) {
    const file = await this.findOneFile(id);
    const path = (file.path as string) || '';
    const isRelative = path.startsWith('/uploads/');
    const resolvedPath = isRelative ? `.${path}` : path;
    
    // Check if document has been signed and get signed file path
    try {
      // First check in document_signatures for signed file path
      const documentSignatureResult = await this.databaseService.query(
        `SELECT signature_data FROM document_signatures 
         WHERE document_id = $1 AND status = 'signed' 
         ORDER BY signed_at DESC LIMIT 1`,
        [id]
      );

      if (documentSignatureResult.rows.length > 0) {
        const signatureData = documentSignatureResult.rows[0].signature_data as { signed_path?: string } | null;
        if (signatureData?.signed_path) {
          const fs = await import('fs');
          if (fs.existsSync(signatureData.signed_path)) {
            console.log('✅ Found signed file (document_signatures):', signatureData.signed_path);
            return {
              path: signatureData.signed_path,
              originalName: (file.original_name || file.filename) as string,
              mimeType: (file.mime_type || 'application/octet-stream') as string,
              size: fs.statSync(signatureData.signed_path).size,
            };
          }
        }
      }

      // Also check in hsm_signedlogs for signed file
      const signedLogResult = await this.databaseService.query(
        `SELECT metadata FROM hsm_signedlogs 
         WHERE document_id = $1 AND status = 'success' 
         ORDER BY signed_at DESC LIMIT 1`,
        [id]
      );

      if (signedLogResult.rows.length > 0) {
        const metadataRaw = signedLogResult.rows[0].metadata;
        let metadata: { signed_path?: string } | null = null;
        
        // Parse JSON if it's a string
        if (typeof metadataRaw === 'string') {
          try {
            metadata = JSON.parse(metadataRaw);
          } catch (e) {
            console.warn('⚠️ Could not parse metadata as JSON:', e);
          }
        } else if (metadataRaw) {
          metadata = metadataRaw as any;
        }
        
        if (metadata?.signed_path) {
          const fs = await import('fs');
          if (fs.existsSync(metadata.signed_path)) {
            console.log('✅ Found signed file (hsm_signedlogs metadata):', metadata.signed_path);
            return {
              path: metadata.signed_path,
              originalName: (file.original_name || file.filename) as string,
              mimeType: (file.mime_type || 'application/octet-stream') as string,
              size: fs.statSync(metadata.signed_path).size,
            };
          }
        }
      }

      // Check in activity_logs for direct signing
      const activityLogResult = await this.databaseService.query(
        `SELECT details FROM activity_logs 
         WHERE target = $1 AND action = 'DIRECT_SIGN' 
         ORDER BY created_at DESC LIMIT 1`,
        [id]
      );

      if (activityLogResult.rows.length > 0) {
        const details = activityLogResult.rows[0].details as { signedFilePath?: string } | null;
        if (details?.signedFilePath) {
          const fs = await import('fs');
          if (fs.existsSync(details.signedFilePath)) {
            console.log('✅ Found signed file (activity_logs):', details.signedFilePath);
            return {
              path: details.signedFilePath,
              originalName: (file.original_name || file.filename) as string,
              mimeType: (file.mime_type || 'application/octet-stream') as string,
              size: fs.statSync(details.signedFilePath).size,
            };
          }
        }
      }

      // Fallback: check for _signed.pdf file in same directory
      const signedPath = resolvedPath.replace('.pdf', '_signed.pdf');
      const fs = await import('fs');
      if (fs.existsSync(signedPath)) {
        console.log('✅ Found signed file (fallback):', signedPath);
        return {
          path: signedPath,
          originalName: (file.original_name || file.filename) as string,
          mimeType: (file.mime_type || 'application/octet-stream') as string,
          size: fs.statSync(signedPath).size,
        };
      }
    } catch (error) {
      console.warn('⚠️ Error checking for signed file:', error);
    }

    // Return original file if no signed version found
    console.log('📄 Returning original file:', resolvedPath);
    return {
      path: resolvedPath,
      originalName: (file.original_name || file.filename) as string,
      mimeType: (file.mime_type || 'application/octet-stream') as string,
      size: Number(file.size || 0),
    };
  }

  /**
   * Sign document directly without delegation workflow
   * POST /api/documents/:documentId/sign-direct
   */
  async signDocumentDirect(
    documentId: string,
    signData: { totpToken: string; metadata?: any },
    currentUserId: string,
  ) {
    try {
      console.log('🔐 === DIRECT SIGN DOCUMENT REQUEST ===');
      console.log('Document ID:', documentId);
      console.log('User ID:', currentUserId);
      console.log('TOTP Token provided:', !!signData.totpToken);

      // 1. Validate document exists
      console.log('Step 1: Validating document exists...');
      const docResult = await this.databaseService.query(
        `SELECT * FROM files WHERE id = $1`,
        [documentId]
      );
      
      if (docResult.rows.length === 0) {
        throw new NotFoundException('Document not found');
      }

      const document = docResult.rows[0];
      console.log('✅ Document found:', document.original_name || document.filename);

      // 2. Validate TOTP token
      console.log('Step 2: Validating TOTP token...');
      if (!signData.totpToken || !/^\d{6}$/.test(signData.totpToken)) {
        throw new BadRequestException('Valid 6-digit TOTP token is required');
      }

      // Get user's TOTP secret for validation
      const userResult = await this.databaseService.query(
        `SELECT totp_secret FROM users WHERE id = $1`,
        [currentUserId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundException('User not found');
      }

      const user = userResult.rows[0];
      if (!user.totp_secret) {
        throw new BadRequestException('User does not have TOTP enabled');
      }

      // Validate TOTP token
      const isValidTotp = await this.totpService.verifyTotpForAuth(currentUserId, signData.totpToken);
      if (!isValidTotp) {
        throw new BadRequestException('Invalid TOTP token');
      }
      console.log('✅ TOTP token validated');

      // 3. Prepare signing metadata
      const signingMetadata = {
        name: signData.metadata?.name || 'Direct Signer',
        reason: signData.metadata?.reason || 'Direct document signing',
        location: signData.metadata?.location || 'Unknown',
        contact: signData.metadata?.contact || 'Unknown',
        organizationUnit: signData.metadata?.organizationUnit || 'Unknown',
        organizationName: signData.metadata?.organizationName || 'Unknown',
        totpVerified: true,
        signedAt: new Date().toISOString(),
        signingMethod: 'direct_hsm_with_totp',
        userAgent: signData.metadata?.userAgent || 'Unknown',
        securityLevel: 'high',
        directSigning: true,
      };

      // 4. Sign document using HSM
      console.log('Step 3: Signing document with HSM...');
      const signResult = await this.digitalSignatureService.signPdf({
        documentId: documentId,
        signatureRequestId: uuidv4(), // Generate proper UUID for database compatibility
        keyId: process.env.HSM_DEFAULT_KEY_ID || '9504359e-949d-488f-a3e6-53c149e60bab',
        placeholder: '{{SIGNATURE_PLACEHOLDER}}',
        metadata: signingMetadata,
      }, currentUserId);

      console.log('✅ Document signed successfully');

      // 5. Log the direct signing activity with signed file path
      console.log('Step 4: Logging direct signing activity...');
      try {
        await this.databaseService.query(
          `INSERT INTO activity_logs (user_id, action, target, details) 
           VALUES ($1, 'DIRECT_SIGN', $2, $3)`,
          [currentUserId, documentId, JSON.stringify({
            signingMethod: 'direct_hsm_with_totp',
            signedAt: new Date().toISOString(),
            documentName: document.original_name || document.filename,
            totpVerified: true,
            securityLevel: 'high',
            signedFilePath: signResult.signedPath, // Store signed file path
          })]
        );
        console.log('✅ Activity logged with signed file path:', signResult.signedPath);
      } catch (logError) {
        console.error('⚠️ Failed to log direct signing activity (non-critical):', logError);
      }

      // 6. Update document status if needed
      try {
        await this.databaseService.query(
          `UPDATE files SET status = 'signed' WHERE id = $1`,
          [documentId]
        );
        console.log('✅ Document status updated to signed');
      } catch (updateError) {
        console.error('⚠️ Failed to update document status (non-critical):', updateError);
      }

      return {
        success: true,
        message: 'Document signed successfully via direct signing',
        signature: signResult,
        documentId: documentId,
        signedAt: new Date().toISOString(),
        signingMethod: 'direct_hsm_with_totp',
        totpVerified: true,
      };

    } catch (error) {
      console.error('❌ Direct signing error:', error);
      throw error;
    }
  }
}
