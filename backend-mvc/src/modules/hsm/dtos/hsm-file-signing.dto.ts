import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';

export class SignerInfoDto {
  @IsString()
  @IsNotEmpty()
  signerName: string;

  @IsOptional()
  @IsEmail()
  signerEmail?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class HSMFileSigningRequestDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @IsOptional()
  @IsString()
  keyId?: string;

  @IsObject()
  @IsNotEmpty()
  signerInfo: SignerInfoDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class HSMFileSigningResponseDto {
  success: boolean;
  signatureId: string;
  signedFilePath: string;
  signatureHash: string;
  hsmKeyId: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export class HSMKeyGenerationDto {
  @IsString()
  @IsNotEmpty()
  keyType: string;

  @IsOptional()
  keySize?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  usage?: string;
}

export class HSMKeyListDto {
  keys?: Array<{
    keyId: string;
    keyType: string;
    status: string;
    label?: string;
  }>;
}

export class HSMSignatureListDto {
  signatures?: any[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
