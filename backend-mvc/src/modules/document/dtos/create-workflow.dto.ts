import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
} from 'class-validator';

export enum WorkflowType {
  DELEGATION = 'delegation',
  APPROVAL = 'approval',
}

export enum WorkflowStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SIGNED = 'signed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  delegator_id: string;

  @IsString()
  @IsNotEmpty()
  delegate_id: string;

  @IsString()
  @IsNotEmpty()
  document_id: string;

  @IsEnum(WorkflowType)
  @IsNotEmpty()
  workflow_type: WorkflowType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}
