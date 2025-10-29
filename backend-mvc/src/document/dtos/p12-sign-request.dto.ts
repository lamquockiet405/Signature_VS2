import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class P12SignatureMetadataDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  contact: string;
}

export class P12SignPdfRequestDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsOptional()
  fieldName?: string; // default: Signature1

  @IsString()
  @IsOptional()
  tsaUrl?: string;

  @IsString()
  @IsOptional()
  certificatePath?: string; // when signing with .p12

  @IsString()
  @IsOptional()
  password?: string; // p12 password

  @IsString()
  @IsOptional()
  hsmKeyId?: string; // alternative: sign via HSM

  @IsObject()
  @IsNotEmpty()
  metadata: P12SignatureMetadataDto;
}
