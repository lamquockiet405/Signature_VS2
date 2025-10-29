export class UpdateDelegationDto {
  status?: string;
  permissions?: any;
  reason?: string;
  start_date?: Date;
  end_date?: Date;
  metadata?: Record<string, any>; // For storing signature drafts, approvals, etc.
}
