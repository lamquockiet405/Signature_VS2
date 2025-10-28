import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { HsmKey } from '../entities/hsm-key.entity';
import { HsmLog } from '../entities/hsm-log.entity';
import { HsmSignedLog } from '../entities/hsm-signed-log.entity';

@Injectable()
export class HsmService {
  private readonly logger = new Logger(HsmService.name);
  private readonly slotId: number;
  private readonly tokenLabel: string;

  constructor(
    @InjectRepository(HsmKey)
    private hsmKeyRepository: Repository<HsmKey>,
    @InjectRepository(HsmLog)
    private hsmLogRepository: Repository<HsmLog>,
    @InjectRepository(HsmSignedLog)
    private hsmSignedLogRepository: Repository<HsmSignedLog>,
  ) {
    this.slotId = parseInt(process.env.HSM_SLOT_ID || '0');
    this.tokenLabel = process.env.HSM_TOKEN_LABEL || 'HSM_Token';
  }

  // ========== Key Management ==========

  async generateKeyPair(params: {
    userId: string;
    keyType?: string;
    keySize?: number;
    keyLabel?: string;
    keyUsage?: string[];
    metadata?: any;
  }) {
    const {
      userId,
      keyType = 'RSA',
      keySize = 2048,
      keyLabel,
      keyUsage = ['sign', 'verify'],
      metadata = {},
    } = params;

    try {
      const keyId = uuidv4();
      
      this.logger.warn('⚠️  SECURITY WARNING: Private key will be stored in database!');
      this.logger.warn('🔒 This is ONLY for development/testing. Remove in production!');

      let publicKey: string = '';
      let privateKey: string = '';
      let algorithm = `${keyType}-${keySize}`;

      if (keyType === 'RSA') {
        this.logger.log(`🔐 Generating RSA-${keySize} key pair with OpenSSL...`);

        const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        });

        publicKey = pubKey;
        privateKey = privKey;

        this.logger.log(`✅ RSA key pair generated successfully`);
        this.logger.log(`   📏 Private key: ${privateKey.length} bytes`);
        this.logger.log(`   📏 Public key: ${publicKey.length} bytes`);
      } else if (keyType === 'ECDSA') {
        this.logger.log(`🔐 Generating ECDSA P-${keySize} key pair with OpenSSL...`);

        const curveMap = {
          256: 'prime256v1',
          384: 'secp384r1',
          521: 'secp521r1',
        };

        const curveName = curveMap[keySize];
        if (!curveName) {
          throw new Error(`Unsupported ECDSA key size: ${keySize}. Supported: 256, 384, 521`);
        }

        algorithm = `ECDSA-P${keySize}`;

        const { publicKey: pubKey, privateKey: privKey } = crypto.generateKeyPairSync('ec', {
          namedCurve: curveName,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        });

        publicKey = pubKey;
        privateKey = privKey;

        this.logger.log(`✅ ECDSA key pair generated successfully`);
        this.logger.log(`   📏 Curve: ${curveName}`);
        this.logger.log(`   📏 Private key: ${privateKey.length} bytes`);
        this.logger.log(`   📏 Public key: ${publicKey.length} bytes`);
      }

      // Create key entity with simplified slot handling
      const key = this.hsmKeyRepository.create({
        key_id: keyId,
        user_id: userId,
        key_type: keyType,
        key_size: keySize,
        algorithm,
        public_key: publicKey,
        private_key: privateKey,
        key_label: keyLabel || `Key-${Date.now()}`,
        key_usage: Array.isArray(keyUsage) ? keyUsage.join(',') : keyUsage,
        slot_id: this.slotId,
        token_label: this.tokenLabel,
        status: 'active',
        metadata,
        private_key_handle: `HSM_HANDLE_${keyId}`,
      });

      const savedKey = await this.hsmKeyRepository.save(key);

      // Log operation
      await this.logOperation({
        operation: 'generate_key',
        keyId,
        userId,
        status: 'success',
        metadata: { keyType, keySize, algorithm },
      });

      return {
        keyId: savedKey.key_id,
        keyType: savedKey.key_type,
        keySize: savedKey.key_size,
        algorithm: savedKey.algorithm,
        publicKey: savedKey.public_key,
        keyLabel: savedKey.key_label,
        keyUsage: savedKey.key_usage,
        status: savedKey.status,
        createdAt: savedKey.created_at,
      };
    } catch (error) {
      await this.logOperation({
        operation: 'generate_key',
        userId,
        status: 'failed',
        errorMessage: error.message,
      });
      throw error;
    }
  }



  async getKeyMetadata(keyId: string, userId: string) {
    this.logger.log(`[HSM Service] getKeyMetadata called: ${keyId}, ${userId}`);

    let key: HsmKey | null;

    if (userId === '0' || userId === '0') {
      // Service account - can access all keys
      this.logger.log('[HSM Service] Service account detected, accessing any key');
      key = await this.hsmKeyRepository.findOne({ where: { key_id: keyId } });
    } else {
      // Normal user - only their keys or shared keys
      key = await this.hsmKeyRepository.findOne({
        where: [
          { key_id: keyId, user_id: userId },
          { key_id: keyId, user_id: null as any },
        ],
      });
    }

    if (!key) {
      this.logger.warn('[HSM Service] Key not found or access denied:', { keyId, userId });
      return null;
    }

    this.logger.log('[HSM Service] Key found:', {
      key_id: key.key_id,
      status: key.status,
      hasPrivateKey: !!key.private_key,
      hasPublicKey: !!key.public_key,
    });

    return key;
  }



  // ========== Signing & Verify ==========




  async logOperation(params: {
    operation: string;
    keyId?: string;
    userId?: string;
    status: string;
    errorMessage?: string;
    executionTimeMs?: number;
    metadata?: any;
  }) {
    const {
      operation,
      keyId = null,
      userId = null,
      status,
      errorMessage = null,
      executionTimeMs = null,
      metadata = {},
    } = params;

    try {
      const fullMetadata = { ...metadata };
      if (executionTimeMs !== null) {
        fullMetadata.executionTimeMs = executionTimeMs;
      }

      await this.hsmLogRepository.save({
        operation,
        key_id: keyId,
        user_id: userId,
        status,
        error_message: errorMessage,
        metadata: fullMetadata,
      } as any);
    } catch (error) {
      this.logger.error('Failed to log operation:', error);
    }
  }

  // ========== Unified Signing ==========

  async unifiedSign(params: {
    keyId: string;
    userId: string;
    type: string;
    data: string;
    algorithm?: string;
    format?: string;
    signerInfo?: any;
    metadata?: any;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    documentId?: string;
    documentName?: string;
    documentType?: string;
    documentSize?: number;
    documentHash?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { 
      keyId, 
      userId, 
      type, 
      data, 
      algorithm, 
      format, 
      signerInfo, 
      metadata,
      fileName,
      fileType,
      fileSize,
      documentId,
      documentName,
      documentType,
      documentSize,
      documentHash,
      ipAddress, 
      userAgent 
    } = params;
    
    const startTime = Date.now();

    try {
      // Verify key exists and belongs to user
      const key = await this.getKeyMetadata(keyId, userId);
      if (!key) {
        throw new Error('Key not found or access denied');
      }

      if (key.status !== 'active') {
        throw new Error('Key is not active');
      }

      // Hash data
      const dataHash = crypto.createHash('sha256').update(data).digest('hex');

      // Mock signing based on type
      let signature: string;
      let signatureFormat: string;
      let signatureAlgorithm: string;

      switch (type) {
        case 'data':
          signature = crypto
            .createHash('sha256')
            .update(keyId + data + Date.now())
            .digest('base64');
          signatureFormat = format || 'raw';
          signatureAlgorithm = algorithm || key.algorithm;
          break;

        case 'cms':
          signature = crypto
            .createHash('sha256')
            .update(keyId + data + 'CMS' + Date.now())
            .digest('base64');
          signatureFormat = 'PKCS7';
          signatureAlgorithm = 'RSA-SHA256';
          break;

        case 'file':
          signature = crypto
            .createHash('sha256')
            .update(keyId + data + 'FILE' + Date.now())
            .digest('base64');
          signatureFormat = 'CMS';
          signatureAlgorithm = 'RSA-SHA256';
          break;

        case 'auto-key':
          signature = crypto
            .createHash('sha256')
            .update(keyId + data + 'AUTO' + Date.now())
            .digest('base64');
          signatureFormat = 'PKCS7';
          signatureAlgorithm = 'RSA-SHA256';
          break;

        default:
          throw new Error(`Unsupported signing type: ${type}`);
      }

      const signatureHash = crypto
        .createHash('sha256')
        .update(signature)
        .digest('hex');

      // Log operation
      const logEntry = this.hsmLogRepository.create({
        operation: `sign_${type}`,
        key_id: keyId,
        user_id: userId,
        data: dataHash.substring(0, 255),
        status: 'success',
        metadata: {
          type,
          format: signatureFormat,
          algorithm: signatureAlgorithm,
          ipAddress,
          userAgent,
          executionTimeMs: Date.now() - startTime,
          dataHash,
          signatureHash,
          fileName,
          fileType,
          fileSize,
          documentId,
          documentName,
          documentType,
          documentSize,
          documentHash,
          signerInfo,
          ...metadata,
        },
      });
      await this.hsmLogRepository.save(logEntry);

      // Log signature details
      await this.hsmSignedLogRepository.save({
        key_id: keyId,
        user_id: userId,
        data_hash: dataHash,
        signature,
        signature_algorithm: signatureAlgorithm,
        hash_algorithm: 'SHA256',
        metadata: { 
          type,
          format: signatureFormat, 
          timestamp: new Date().toISOString(),
          fileName,
          fileType,
          documentId,
          documentName,
          signerInfo,
        },
      });

      // Return result based on type
      const baseResult = {
        signature,
        signatureHash,
        algorithm: signatureAlgorithm,
        format: signatureFormat,
        dataHash,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };

      switch (type) {
        case 'cms':
          return {
            ...baseResult,
            cmsSignature: signature,
            signerInfo: signerInfo || {
              name: 'Digital Signature Service',
              organization: 'HSM Service',
            },
          };

        case 'file':
          return {
            ...baseResult,
            cmsSignature: signature,
            signerInfo: signerInfo || {
              name: 'File Signer',
              organization: 'HSM Service',
            },
            fileInfo: {
              fileName,
              fileType,
              fileSize,
            },
          };

        case 'auto-key':
          return {
            ...baseResult,
            keyInfo: {
              keyId: 'mock-key-id',
              keyType: 'RSA',
              algorithm: 'RSA-2048',
              isNewKey: true,
            },
            certificate: 'mock-certificate',
            certificateChain: ['mock-cert1', 'mock-cert2'],
            certificateInfo: {
              subject: [{ shortName: 'CN', value: signerInfo?.name || 'Mock Signer' }],
              issuer: [{ shortName: 'CN', value: 'Mock CA' }],
              serialNumber: '123456',
              validFrom: new Date().toISOString(),
              validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            },
            documentInfo: {
              documentId: documentId || 'mock-doc-id',
              documentName: documentName || 'Untitled Document',
              documentType: documentType || 'application/pdf',
              documentSize: documentSize || 0,
              documentHash: documentHash,
            },
            signerInfo: signerInfo || {
              name: 'Unknown Signer',
              email: '',
              organization: '',
              organizationUnit: '',
              reason: 'Document signing',
              location: 'Vietnam',
            },
          };

        default:
          return baseResult;
      }
    } catch (error) {
      await this.logOperation({
        operation: `sign_${type}`,
        keyId,
        userId,
        status: 'failed',
        errorMessage: error.message,
        metadata: {
          type,
          ipAddress,
          userAgent,
          executionTimeMs: Date.now() - startTime,
        },
      });
      throw error;
    }
  }


}
