import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';

// ============================================
// INTERFACES
// ============================================

export interface HSMKey {
  keyId: string;
  keyType: string;
  keySize: number;
  algorithm: string;
  publicKey: string;
  keyLabel: string;
  keyUsage: string[];
  status: string;
  createdAt: string;
}

export interface HSMSignResult {
  success: boolean;
  signature?: string;
  signatureHash?: string;
  algorithm?: string;
  format?: string;
  dataHash?: string;
  timestamp?: string;
}

export interface HSMCMSResult {
  success: boolean;
  cmsSignature?: string;
  signatureHash?: string;
  algorithm?: string;
  format?: string;
  dataHash?: string;
  signerInfo?: any;
  timestamp?: string;
}

export interface FileSigningRequest {
  fileId: string;
  userId: string;
  keyId?: string;
  signerInfo: {
    signerName: string;
    signerEmail?: string;
    reason?: string;
    location?: string;
  };
  metadata?: Record<string, any>;
}

export interface FileSigningResult {
  success: boolean;
  signatureId: string;
  signedFilePath: string;
  signatureHash: string;
  hsmKeyId: string;
  timestamp: string;
  metadata: Record<string, any>;
}

/**
 * HSM File Signing Service (Merged with HSM Client)
 *
 * This service combines:
 * 1. HSM Client functionality (HTTP calls to HSM server)
 * 2. File signing business logic (database, file operations)
 *
 * All HSM client methods are now private methods within this service.
 */
@Injectable()
export class HSMFileSigningService {
  private readonly hsmBaseUrl: string;
  private readonly hsmApiPath: string;

  constructor(private databaseService: DatabaseService) {
    this.hsmBaseUrl = process.env.HSM_BASE_URL || 'http://localhost:3002';
    this.hsmApiPath = '/hsm';
  }

  // ============================================
  // PUBLIC API - FILE SIGNING OPERATIONS
  // ============================================

  /**
   * Gửi file lên HSM để ký số
   * Luồng: Frontend → KMS (backend) → HSM service → Ký số → Ghi log → Trả kết quả
   */
  async signFile(request: FileSigningRequest): Promise<FileSigningResult> {
    try {
      console.log('🔐 [HSM File Signing] Starting file signing process...');
      console.log('📄 Request:', request);

      // Server OTP verification removed - using TOTP for authentication instead

      // 1. Kiểm tra file tồn tại và thuộc về user
      const file = await this.validateFileAccess(
        request.fileId,
        request.userId,
      );
      console.log('✅ File validated:', file.original_filename);

      // 2. Đọc file và tạo hash
      const fileBuffer = await fs.readFile(file.file_path);
      const fileHash = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');
      console.log('📊 File hash created:', fileHash.substring(0, 16) + '...');

      // 3. Lấy hoặc tạo HSM key cho user
      const hsmKeyId = await this.getOrCreateHSMKey(
        request.userId,
        request.keyId,
      );
      console.log('🔑 HSM key ready:', hsmKeyId);

      // 4. Gọi HSM service để ký số
      const hsmSignResult = await this.hsmSignFile(
        { id: request.userId },
        hsmKeyId,
        {
          fileHash,
          fileName: file.original_filename,
          fileType: file.file_type,
          fileSize: fileBuffer.length,
          signerInfo: request.signerInfo,
        },
      );

      console.log('✅ HSM signing completed');

      // 5. Tạo file đã ký (embed signature vào file với visual metadata)
      const signedFilePath = await this.createSignedFile(
        file.file_path,
        hsmSignResult.cmsSignature || '',
        file.original_filename,
        request.metadata, // Truyền metadata từ request
      );

      // 6. Tạo signature hash
      const signatureHash = crypto
        .createHash('sha256')
        .update(hsmSignResult.cmsSignature || '')
        .digest('hex');

      // 7. Lưu thông tin chữ ký vào database
      const signatureId = await this.saveSignatureRecord({
        fileId: request.fileId,
        userId: request.userId,
        hsmKeyId,
        signatureHash,
        signedFilePath,
        hsmSignature: hsmSignResult.cmsSignature || '',
        signerInfo: request.signerInfo,
        metadata: request.metadata,
      });

      // 8. Cập nhật trạng thái file
      await this.updateFileStatus(request.fileId, 'signed');

      // 9. Ghi audit log
      await this.logAuditEvent({
        userId: request.userId,
        action: 'hsm_file_signed',
        resourceType: 'file',
        resourceId: request.fileId,
        details: {
          signatureId,
          hsmKeyId,
          fileHash,
          signatureHash,
          signerInfo: request.signerInfo,
        },
      });

      const result: FileSigningResult = {
        success: true,
        signatureId,
        signedFilePath,
        signatureHash,
        hsmKeyId,
        timestamp: new Date().toISOString(),
        metadata: {
          originalFile: file.original_filename,
          fileSize: fileBuffer.length,
          fileHash,
          hsmSignature: hsmSignResult.cmsSignature,
          signerInfo: request.signerInfo,
          ...request.metadata,
        },
      };

      console.log('🎉 File signing completed successfully');
      return result;
    } catch (error) {
      console.error('❌ File signing failed:', error);

      // Ghi log lỗi
      await this.logAuditEvent({
        userId: request.userId,
        action: 'hsm_file_sign_failed',
        resourceType: 'file',
        resourceId: request.fileId,
        details: {
          error: error.message,
          signerInfo: request.signerInfo,
        },
      });

      throw new BadRequestException(`File signing failed: ${error.message}`);
    }
  }

  /**
   * Lấy danh sách chữ ký của user
   */
  async getUserSignatures(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const result = await this.databaseService.query(
      `SELECT ds.*, f.original_filename, f.file_type, f.file_size
       FROM digital_signatures ds
       JOIN files f ON ds.file_id = f.id
       WHERE ds.user_id = $1 AND ds.verification_status = 'valid'
       ORDER BY ds.signature_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const countResult = await this.databaseService.query(
      `SELECT COUNT(*) FROM digital_signatures ds
       JOIN files f ON ds.file_id = f.id
       WHERE ds.user_id = $1 AND ds.verification_status = 'valid'`,
      [userId],
    );

    return {
      signatures: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    };
  }

  /**
   * Tải file đã ký
   */
  async downloadSignedFile(signatureId: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT ds.*, f.original_filename, f.uploaded_by
       FROM digital_signatures ds
       JOIN files f ON ds.file_id = f.id
       WHERE ds.id = $1 AND f.uploaded_by = $2`,
      [signatureId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Signature not found or access denied');
    }

    const signature = result.rows[0];

    if (!signature.signed_file_path) {
      throw new NotFoundException('Signed file not found');
    }

    try {
      const fileBuffer = await fs.readFile(signature.signed_file_path);
      return {
        buffer: fileBuffer,
        filename: signature.original_filename.replace(
          '.pdf',
          '_hsm_signed.pdf',
        ),
        contentType: 'application/pdf',
      };
    } catch (error) {
      throw new NotFoundException('Signed file not found on disk');
    }
  }

  // ============================================
  // PUBLIC API - HSM KEY MANAGEMENT (Exposed for SignatureController)
  // ============================================

  /**
   * Tạo cặp key mới trong HSM (Public method for controller)
   */
  async generateKey(
    user: any,
    keyParams: {
      keyType?: string;
      keySize?: number;
      label?: string;
      usage?: string;
    } = {},
  ): Promise<{
    success: boolean;
    keyId?: string;
    publicKey?: string;
    metadata?: any;
  }> {
    return this.hsmGenerateKey(user, keyParams);
  }

  /**
   * Lấy danh sách keys của user (Public method for controller)
   */
  async listKeys(
    user: any,
    filters: {
      status?: string;
      keyType?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ success: boolean; keys?: HSMKey[]; total?: number }> {
    return this.hsmListKeys(user, filters);
  }

  // ============================================
  // PRIVATE METHODS - HSM CLIENT OPERATIONS
  // ============================================

  /**
   * Tạo JWT token từ user context
   */
  private getAuthToken(user: any): string {
    if (user.token) {
      return user.token;
    }

    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        id: user.id || user.userId,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' },
    );
  }

  /**
   * HSM: Tạo cặp key mới
   */
  private async hsmGenerateKey(
    user: any,
    keyParams: {
      keyType?: string;
      keySize?: number;
      label?: string;
      usage?: string;
    } = {},
  ): Promise<{
    success: boolean;
    keyId?: string;
    publicKey?: string;
    metadata?: any;
  }> {
    try {
      const {
        keyType = 'RSA',
        keySize = 2048,
        label = `User_${user.id}_Key`,
        usage = 'sign',
      } = keyParams;

      const token = this.getAuthToken(user);

      const response: AxiosResponse = await axios.post(
        `${this.hsmBaseUrl}${this.hsmApiPath}/keys/generate`,
        { keyType, keySize, label, usage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.success) {
        return {
          success: true,
          keyId: response.data.data.keyId,
          publicKey: response.data.data.publicKey,
          metadata: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to generate key');
    } catch (error) {
      console.error(
        'HSM generateKey error:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        `HSM key generation failed: ${error.response?.data?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * HSM: Lấy danh sách keys
   */
  private async hsmListKeys(
    user: any,
    filters: {
      status?: string;
      keyType?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ success: boolean; keys?: HSMKey[]; total?: number }> {
    try {
      const token = this.getAuthToken(user);
      const params = new URLSearchParams(filters as any).toString();

      const response: AxiosResponse = await axios.get(
        `${this.hsmBaseUrl}${this.hsmApiPath}/keys?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        return {
          success: true,
          keys: response.data.data.keys,
          total: response.data.data.total,
        };
      }

      throw new Error(response.data.message || 'Failed to list keys');
    } catch (error) {
      console.error(
        'HSM listKeys error:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        `HSM list keys failed: ${error.response?.data?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * HSM: Lấy thông tin key
   */
  private async hsmGetKey(
    user: any,
    keyId: string,
  ): Promise<{ success: boolean; key?: HSMKey }> {
    try {
      const token = this.getAuthToken(user);

      const response: AxiosResponse = await axios.get(
        `${this.hsmBaseUrl}${this.hsmApiPath}/key/${keyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success) {
        return {
          success: true,
          key: response.data.data,
        };
      }

      throw new Error(response.data.message || 'Failed to get key');
    } catch (error) {
      console.error('HSM getKey error:', error.response?.data || error.message);
      throw new HttpException(
        `HSM get key failed: ${error.response?.data?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * HSM: Ký file với thông tin chi tiết
   */
  private async hsmSignFile(
    user: any,
    keyId: string,
    fileData: {
      fileHash: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      signerInfo: any;
    },
  ): Promise<HSMCMSResult> {
    try {
      const token = this.getAuthToken(user);

      const response: AxiosResponse = await axios.post(
        `${this.hsmBaseUrl}${this.hsmApiPath}/sign/file`,
        {
          keyId,
          userId: user.id,
          fileHash: fileData.fileHash,
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileSize: fileData.fileSize,
          signerInfo: fileData.signerInfo,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.success) {
        return {
          success: true,
          cmsSignature: response.data.data.cmsSignature,
          signatureHash: response.data.data.signatureHash,
          algorithm: response.data.data.algorithm,
          format: response.data.data.format,
          dataHash: response.data.data.dataHash,
          signerInfo: response.data.data.signerInfo,
          timestamp: response.data.data.timestamp,
        };
      }

      throw new Error(response.data.message || 'Failed to sign file');
    } catch (error) {
      console.error(
        'HSM signFile error:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        `HSM file signing failed: ${error.response?.data?.message || error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================
  // PRIVATE METHODS - FILE & DATABASE OPERATIONS
  // ============================================

  /**
   * Kiểm tra file tồn tại và user có quyền truy cập
   */
  private async validateFileAccess(fileId: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT id, original_filename, file_path, file_type, file_size, uploaded_by, status
       FROM files 
       WHERE id = $1 AND uploaded_by = $2`,
      [fileId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('File not found or access denied');
    }

    const file = result.rows[0];

    if (file.status === 'signed') {
      throw new BadRequestException('File has already been signed');
    }

    try {
      await fs.access(file.file_path);
    } catch {
      throw new NotFoundException('File not found on disk');
    }

    return file;
  }

  /**
   * Lấy hoặc tạo HSM key cho user
   */
  private async getOrCreateHSMKey(
    userId: string,
    keyId?: string,
  ): Promise<string> {
    try {
      // Nếu có keyId được chỉ định, kiểm tra key đó
      if (keyId) {
        const keyResult = await this.hsmGetKey({ id: userId }, keyId);
        if (keyResult.success) {
          return keyId;
        }
      }

      // Lấy danh sách keys của user
      const keysResult = await this.hsmListKeys(
        { id: userId },
        {
          status: 'active',
          keyType: 'RSA',
        },
      );

      if (keysResult.success && keysResult.keys && keysResult.keys.length > 0) {
        return keysResult.keys[0].keyId;
      }

      // Tạo key mới nếu chưa có
      console.log('🔑 Creating new HSM key for user:', userId);
      const keyResult = await this.hsmGenerateKey(
        { id: userId },
        {
          keyType: 'RSA',
          keySize: 2048,
          label: `User_${userId}_SignKey_${Date.now()}`,
          usage: 'sign',
        },
      );

      if (!keyResult.success || !keyResult.keyId) {
        throw new Error('Failed to generate HSM key');
      }

      return keyResult.keyId;
    } catch (error) {
      console.error('❌ HSM key management failed:', error);
      throw new Error(`HSM key management failed: ${error.message}`);
    }
  }

  /**
   * Tạo file đã ký bằng cách embed signature + visual metadata
   */
  private async createSignedFile(
    originalFilePath: string,
    signature: string,
    originalFilename: string,
    metadata?: any,
  ): Promise<string> {
    try {
      const originalDir = path.dirname(originalFilePath);
      const originalName = path.basename(
        originalFilename,
        path.extname(originalFilename),
      );
      const signedFilename = `${originalName}_hsm_signed.pdf`;
      const signedFilePath = path.join(originalDir, signedFilename);

      // 1. Thêm visual metadata box vào PDF trước
      const { addMetadataAndPlaceholder } = await import(
        '../../document/utils/pdf-utils.js'
      );
      
      const pdfWithMetadata = await addMetadataAndPlaceholder(
        originalFilePath,
        metadata || {
          name: 'HSM Signer',
          reason: 'Digital Signature',
          location: 'Vietnam',
          organizationName: 'CHUKI System',
        },
      );

      // 2. Append signature vào PDF đã có metadata
      const signatureBuffer = Buffer.from(signature, 'base64');
      const signedBuffer = Buffer.concat([pdfWithMetadata, signatureBuffer]);

      await fs.writeFile(signedFilePath, signedBuffer);

      console.log('✅ Signed file created with visual metadata:', signedFilePath);
      return signedFilePath;
    } catch (error) {
      console.error('❌ Failed to create signed file:', error);
      throw new Error(`Failed to create signed file: ${error.message}`);
    }
  }

  /**
   * Lưu thông tin chữ ký vào database
   */
  private async saveSignatureRecord(data: {
    fileId: string;
    userId: string;
    hsmKeyId: string;
    signatureHash: string;
    signedFilePath: string;
    hsmSignature: string;
    signerInfo: any;
    metadata?: any;
  }): Promise<string> {
    const result = await this.databaseService.query(
      `INSERT INTO digital_signatures (
        file_id, user_id, signature_data, signature_hash, 
        signature_algorithm, signature_timestamp, signed_file_path,
        verification_status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        data.fileId,
        data.userId,
        data.hsmSignature,
        data.signatureHash,
        'HSM-RSA-SHA256',
        new Date(),
        data.signedFilePath,
        'valid',
        JSON.stringify({
          hsmKeyId: data.hsmKeyId,
          signerInfo: data.signerInfo,
          signingMethod: 'hsm',
          ...data.metadata,
        }),
      ],
    );

    return result.rows[0].id;
  }

  /**
   * Cập nhật trạng thái file
   */
  private async updateFileStatus(fileId: string, status: string) {
    await this.databaseService.query(
      `UPDATE files SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, fileId],
    );
  }

  /**
   * Ghi audit log
   */
  private async logAuditEvent(data: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details: any;
  }) {
    try {
      await this.databaseService.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          data.userId,
          data.action,
          data.resourceType,
          data.resourceId,
          JSON.stringify(data.details),
        ],
      );
    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
    }
  }
}
