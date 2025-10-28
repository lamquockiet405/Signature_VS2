import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListKeysQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  keyType?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class GetLogsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['all', 'signed', 'generate_key', 'delete_key'])
  type?: string = 'all';

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
