import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { LogHelper } from '../../common/helpers/log.helper';

@Injectable()
export class CompanyService {
  constructor(private databaseService: DatabaseService) {}

  async getCompanyInfo() {
    const result = await this.databaseService.query(
      'SELECT * FROM company LIMIT 1',
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Company information not found');
    }

    return result.rows[0];
  }

  async updateCompanyInfo(updateData: any, userId?: string) {
    const { name, address, phone, email, tax_code, website, logo_url } =
      updateData;

    const currentResult = await this.databaseService.query(
      'SELECT * FROM company LIMIT 1',
    );

    if (currentResult.rows.length === 0) {
      throw new NotFoundException('Company information not found');
    }

    const companyId = currentResult.rows[0].id;

    const result = await this.databaseService.query(
      `UPDATE company 
       SET name = COALESCE($1, name),
           address = COALESCE($2, address),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           tax_code = COALESCE($5, tax_code),
           website = COALESCE($6, website),
           logo_url = COALESCE($7, logo_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, address, phone, email, tax_code, website, logo_url, companyId],
    );

    // Log the action
    await LogHelper.createLog(this.databaseService, {
      userId,
      action: 'COMPANY_UPDATE',
      module: 'company',
      description: 'Updated company information',
      metadata: { companyId },
    });

    return result.rows[0];
  }
}
