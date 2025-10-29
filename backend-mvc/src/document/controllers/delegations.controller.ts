import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { DelegationsService } from '../services/delegations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('api/delegations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Get('roles')
  @RequirePermission('delegations', 'read')
  async getRoles() {
    return this.delegationsService.getRoles();
  }

  @Post()
  @RequirePermission('delegations', 'create')
  async create(
    @Body() createData: any,
    @Headers('x-user-id') currentUserId: string,
  ) {
    const delegation = await this.delegationsService.create(
      createData,
      currentUserId,
    );
    return {
      message: 'Delegation created successfully',
      delegation,
    };
  }

  @Get()
  @RequirePermission('delegations', 'read')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    const pageNum = parseInt(page || '1') || 1;
    const limitNum = parseInt(limit || '1000') || 1000;
    return this.delegationsService.findAll(pageNum, limitNum, filters);
  }

  @Get(':id')
  @RequirePermission('delegations', 'read')
  async findOne(@Param('id') id: string) {
    return this.delegationsService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('delegations', 'update')
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @UserId() currentUserId: string,
  ) {
    const delegation = await this.delegationsService.update(
      id,
      updateData,
      currentUserId,
    );
    return {
      message: 'Delegation updated successfully',
      delegation,
    };
  }

  @Delete(':id')
  @RequirePermission('delegations', 'delete')
  async remove(@Param('id') id: string, @UserId() currentUserId: string) {
    const delegation = await this.delegationsService.remove(id, currentUserId);
    return {
      message: 'Delegation revoked successfully',
      delegation,
    };
  }
}
