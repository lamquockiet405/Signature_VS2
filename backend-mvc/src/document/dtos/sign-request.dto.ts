import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class SignatureMetadataDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsString()
  @IsOptional()
  organizationUnit?: string;

  @IsString()
  @IsOptional()
  organizationName?: string;
}

export class SignRequestDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsOptional()
  signatureRequestId?: string;

  @IsString()
  @IsOptional()
  keyId?: string;

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsObject()
  @IsNotEmpty()
  metadata: SignatureMetadataDto;
}
