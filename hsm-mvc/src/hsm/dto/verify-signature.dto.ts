import { IsString, IsOptional } from 'class-validator';

export class VerifySignatureDto {
  @IsString()
  keyId: string;

  @IsString()
  data: string;

  @IsString()
  signature: string;

  @IsOptional()
  @IsString()
  algorithm?: string;
}
