import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
  Headers,
} from '@nestjs/common';
import { PermissionsService } from '../services/permisstions.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/permissions.decorator';

// Permissions endpoints (kept)
@Controller('api/permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @RequirePermission('permissions', 'create')
  async create(
    @Body() createData: any,
    @Headers('x-user-id') currentUserId: string,
  ) {
    const permission = await this.permissionsService.create(
      createData,
      currentUserId,
    );
    return {
      message: 'Permission created successfully',
      permission,
    };
  }

  @Get()
  @RequirePermission('permissions', 'read')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    const pageNum = parseInt(page || '1') || 1;
    const limitNum = parseInt(limit || '10') || 10;
    return this.permissionsService.findAll(pageNum, limitNum, filters);
  }

  @Get('stats/summary')
  @RequirePermission('permissions', 'read')
  async getStats() {
    return this.permissionsService.getStats();
  }

  @Get(':id')
  @RequirePermission('permissions', 'read')
  async findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('permissions', 'update')
  async update(
    @Param('id') id: string,
    @Body() updateData: any,
    @Headers('x-user-id') currentUserId: string,
  ) {
    const permission = await this.permissionsService.update(
      id,
      updateData,
      currentUserId,
    );
    return {
      message: 'Permission updated successfully',
      permission,
    };
  }

  @Delete(':id')
  @RequirePermission('permissions', 'delete')
  async remove(
    @Param('id') id: string,
    @Headers('x-user-id') currentUserId: string,
  ) {
    const permission = await this.permissionsService.remove(id, currentUserId);
    return {
      message: 'Permission revoked successfully',
      permission,
    };
  }
}
