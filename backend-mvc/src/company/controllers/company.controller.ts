import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { CompanyService } from '../services/company.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';

@Controller('api/company')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @RequirePermission('company', 'read')
  async getCompanyInfo() {
    return this.companyService.getCompanyInfo();
  }

  @Put()
  @RequirePermission('company', 'update')
  async updateCompanyInfo(@Body() updateData: any, @UserId() userId: string) {
    const company = await this.companyService.updateCompanyInfo(
      updateData,
      userId,
    );
    return {
      message: 'Company information updated successfully',
      company,
    };
  }
}
