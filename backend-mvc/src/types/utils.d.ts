/**
 * Utility types and helper function definitions
 */

declare global {
  /**
   * CMS (Cryptographic Message Syntax) builder options
   */
  interface CMSBuilderOptions {
    data: Buffer;
    certificate: string | Buffer;
    privateKey?: string | Buffer;
    signature?: Buffer;
    signerInfo?: {
      name?: string;
      reason?: string;
      location?: string;
      contactInfo?: string;
    };
  }

  /**
   * CMS signature result
   */
  interface CMSSignatureResult {
    cmsSignature: string;
    signatureHash: string;
    timestamp: string;
  }

  /**
   * P12 certificate info
   */
  interface P12CertificateInfo {
    certificate: any;
    privateKey: any;
    certificateChain?: any[];
  }

  /**
   * TSA (Time Stamp Authority) request
   */
  interface TSARequest {
    digest: Buffer;
    algorithm?: string;
  }

  /**
   * TSA response
   */
  interface TSAResponse {
    timestamp: string;
    token: Buffer;
  }

  /**
   * PDF placeholder options
   */
  interface PDFPlaceholderOptions {
    pdfBuffer: Buffer;
    reason?: string;
    signatureLength?: number;
    widgetRect?: [number, number, number, number];
  }

  /**
   * Byte range for PDF signature
   */
  interface PDFByteRange {
    byteRangePos: number;
    byteRangePlaceholder: string;
    byteRangeStrings: string[];
  }

  /**
   * Log options for helper
   */
  interface LogOptions {
    level?: 'info' | 'warn' | 'error' | 'debug';
    module?: string;
    userId?: string;
    action?: string;
    details?: any;
  }

  /**
   * Error response format
   */
  interface ErrorResponse {
    success: false;
    message: string;
    error?: string;
    statusCode?: number;
    timestamp: string;
    path?: string;
  }

  /**
   * Success response format
   */
  interface SuccessResponse<T = any> {
    success: true;
    message?: string;
    data: T;
    timestamp?: string;
  }
}

export {};

