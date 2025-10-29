import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LogsService } from '../services/logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';

@Controller('api/logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @RequirePermission('history', 'read')
  async findAll(@Query() query: any) {
    return this.logsService.findAll(query);
  }

  @Get('stats/summary')
  @RequirePermission('history', 'read')
  async getStatsSummary() {
    return this.logsService.getStatsSummary();
  }

  @Get('stats/actions')
  @RequirePermission('history', 'read')
  async getActionStats(@Query() query: any) {
    return this.logsService.getActionStats(query);
  }

  @Get(':id')
  @RequirePermission('history', 'read')
  async findOne(@Param('id') id: string) {
    return this.logsService.findOne(id);
  }
}
