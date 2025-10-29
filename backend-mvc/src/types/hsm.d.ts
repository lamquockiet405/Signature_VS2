/**
 * HSM (Hardware Security Module) type definitions
 */

declare global {
  /**
   * HSM Key information
   */
  interface HSMKey {
    keyId: string;
    keyType: string;
    keySize: number;
    algorithm: string;
    publicKey: string;
    keyLabel: string;
    keyUsage: string[];
    status: 'active' | 'inactive' | 'revoked';
    createdAt: string;
    userId?: string;
  }

  /**
   * HSM signing result
   */
  interface HSMSignResult {
    success: boolean;
    signature?: string;
    signatureHash?: string;
    algorithm?: string;
    format?: string;
    dataHash?: string;
    timestamp?: string;
  }

  /**
   * HSM CMS (Cryptographic Message Syntax) result
   */
  interface HSMCMSResult {
    success: boolean;
    cmsSignature?: string;
    signatureHash?: string;
    algorithm?: string;
    format?: string;
    dataHash?: string;
    signerInfo?: any;
    timestamp?: string;
  }

  /**
   * HSM key generation parameters
   */
  interface HSMKeyParams {
    keyType?: 'RSA' | 'EC' | 'AES';
    keySize?: number;
    label?: string;
    usage?: 'sign' | 'encrypt' | 'both';
  }

  /**
   * HSM key list filters
   */
  interface HSMKeyFilters {
    status?: string;
    keyType?: string;
    page?: number;
    limit?: number;
  }

  /**
   * File signing request to HSM
   */
  interface FileSigningRequest {
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

  /**
   * File signing result from HSM
   */
  interface FileSigningResult {
    success: boolean;
    signatureId: string;
    signedFilePath: string;
    signatureHash: string;
    hsmKeyId: string;
    timestamp: string;
    metadata: Record<string, any>;
  }

  /**
   * HSM signing context
   */
  interface HSMSigningContext {
    keyId: string;
    userId: string;
    fileHash: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    signerInfo: {
      signerName: string;
      signerEmail?: string;
      reason?: string;
      location?: string;
    };
  }
}

export {};
