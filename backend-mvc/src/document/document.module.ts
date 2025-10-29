import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CompanyModule } from '../company/company.module';
import { AuthModule } from '../auth/auth.module';

// Controllers
import { DocumentManagementController } from './controllers/documents.controller';
import { SignatureController } from './controllers/signature.controller';
import { DelegationsController } from './controllers/delegations.controller';
import { WorkflowActionsController } from './controllers/workflow-actions.controller';
import { WorkflowListController } from './controllers/workflow-list.controller';

// Services
import { DocumentManagementService } from './services/documents.service';
import { DigitalSignatureService } from './services/signature.service';
import { DelegationsService } from './services/delegations.service';
import { HSMFileSigningService } from '../hsm/services/hsm-file-signing.service';
import { PdfFixSignatureService } from './services/pdf-fix-signature.service';
import { PdfSignService } from './services/pdf-sign.service';
import { WorkflowService } from './services/workflow.service';

@Module({
  imports: [DatabaseModule, CompanyModule, AuthModule],
  controllers: [
    DocumentManagementController,
    SignatureController,
    DelegationsController,
    WorkflowActionsController,
    WorkflowListController,
  ],
  providers: [
    DocumentManagementService,
    DigitalSignatureService,
    DelegationsService,
    HSMFileSigningService,
    PdfFixSignatureService,
    PdfSignService,
    WorkflowService,
  ],
  exports: [
    DocumentManagementService,
    DigitalSignatureService,
    DelegationsService,
    HSMFileSigningService,
    PdfFixSignatureService,
    PdfSignService,
    WorkflowService,
  ],
})
export class DocumentModule {}
