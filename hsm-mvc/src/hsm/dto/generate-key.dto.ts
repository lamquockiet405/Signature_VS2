import { IsString, IsNumber, IsArray, IsOptional, IsIn } from 'class-validator';

export class GenerateKeyDto {
  @IsString()
  @IsIn(['RSA', 'ECDSA', 'AES'])
  keyType: string;

  @IsNumber()
  keySize: number;

  @IsOptional()
  @IsString()
  keyLabel?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyUsage?: string[];

  @IsOptional()
  metadata?: any;
}
