import { IsString, IsOptional, IsIn, IsObject, IsNumber } from 'class-validator';

export class SignerInfoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  organizationUnit?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class UnifiedSignDto {
  @IsString()
  keyId: string;

  @IsString()
  @IsIn(['data', 'cms', 'file', 'auto-key'])
  type: string;

  @IsString()
  data: string; // data, fileHash, documentHash

  @IsOptional()
  @IsString()
  algorithm?: string;

  @IsOptional()
  @IsString()
  @IsIn(['raw', 'hex', 'base64', 'PKCS7', 'CMS'])
  format?: string;

  @IsOptional()
  @IsObject()
  signerInfo?: SignerInfoDto;

  @IsOptional()
  @IsObject()
  metadata?: any;

  // File-specific fields
  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  // Auto-key specific fields
  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  documentName?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsNumber()
  documentSize?: number;

  @IsOptional()
  @IsString()
  documentHash?: string;
}
