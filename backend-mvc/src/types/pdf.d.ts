/**
 * PDF-related type definitions
 */

declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
      Title?: string;
      Author?: string;
      Subject?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
    };
    metadata: any;
    text: string;
    version: string;
  }

  function parse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export = parse;
}

declare global {
  /**
   * Signature metadata for PDF signing
   */
  interface SignatureMetadata {
    name: string;
    reason?: string;
    location?: string;
    contact?: string;
    organizationName?: string;
    date?: Date;
  }

  /**
   * PDF signature field options
   */
  interface SignatureFieldOptions {
    reason?: string;
    location?: string;
    signatureLength?: number;
    widgetRect?: [number, number, number, number];
    placeholder?: string;
  }

  /**
   * PDF signature result
   */
  interface PdfSignResult {
    success: boolean;
    signedPdfPath?: string;
    signedPdfBuffer?: Buffer;
    signatureHash?: string;
    timestamp?: string;
    error?: string;
  }

  /**
   * Certificate information
   */
  interface CertificateInfo {
    subject: {
      commonName?: string;
      organization?: string;
      organizationalUnit?: string;
      country?: string;
    };
    issuer: {
      commonName?: string;
      organization?: string;
      country?: string;
    };
    validFrom?: string;
    validTo?: string;
    serialNumber?: string;
  }

  /**
   * PDF validation result
   */
  interface PdfValidationResult {
    isValid: boolean;
    isSigned: boolean;
    message: string;
    signatures?: any[];
    certificateInfo?: CertificateInfo;
  }
}

export {};

