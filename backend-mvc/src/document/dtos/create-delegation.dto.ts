export class CreateDelegationDto {
  delegator_id: string;
  delegate_id: string;
  document_id?: string; // Optional: ID of document to be signed
  permissions: any;
  reason?: string;
  start_date?: Date;
  end_date?: Date;
}
