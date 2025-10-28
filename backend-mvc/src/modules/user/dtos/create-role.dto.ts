import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionDto {
  @IsString()
  module: string;

  @IsBoolean()
  @IsOptional()
  can_create?: boolean = false;

  @IsBoolean()
  @IsOptional()
  can_read?: boolean = false;

  @IsBoolean()
  @IsOptional()
  can_update?: boolean = false;

  @IsBoolean()
  @IsOptional()
  can_delete?: boolean = false;

  @IsBoolean()
  @IsOptional()
  can_approve?: boolean = false;
}

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive' = 'active';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  @IsOptional()
  permissions?: PermissionDto[] = [];
}
