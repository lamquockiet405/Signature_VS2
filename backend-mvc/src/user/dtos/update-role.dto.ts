import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
  permissions?: Array<{
    module: string;
    can_create?: boolean;
    can_read?: boolean;
    can_update?: boolean;
    can_delete?: boolean;
    can_approve?: boolean;
  }>;
}
