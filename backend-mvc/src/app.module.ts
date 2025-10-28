import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';

// Main modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CompanyModule } from './modules/company/company.module';
import { DocumentModule } from './modules/document/document.module';
import { HsmModule } from './modules/hsm/hsm.module';

import { FilteredLoggingInterceptor } from './common/interceptors/filtered-logging.interceptor';

@Module({
  imports: [
    DatabaseModule,

    // Main modules
    AuthModule,
    UserModule,
    CompanyModule,
    DocumentModule,
    HsmModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: FilteredLoggingInterceptor,
    },
  ],
})
export class AppModule {}
