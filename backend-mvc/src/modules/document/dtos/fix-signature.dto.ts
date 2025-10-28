export class FixSignatureDto {
  pdfPath: string;
  certificatePath?: string;
  password?: string;
  tsaUrl?: string;
  hsmKeyId?: string; // For HSM-based signing
  metadata?: {
    reason?: string;
    location?: string;
    contact?: string;
    name?: string;
    email?: string;
  };
}

export class FixSignatureResponseDto {
  success: boolean;
  message: string;
  outputPath?: string;
  signatureInfo?: {
    signer: string;
    timestamp?: string;
    certificateChain: number;
    isValid: boolean;
  };
  rootCaCertPath?: string; // Path to root CA cert for manual import
  instructions?: string[];
}
