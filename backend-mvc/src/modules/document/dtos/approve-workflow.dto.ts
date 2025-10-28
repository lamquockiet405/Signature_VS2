import { IsString, IsOptional } from 'class-validator';

export class ApproveWorkflowDto {
  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  approver_note?: string;

  @IsString()
  @IsOptional()
  totpToken?: string;
}
