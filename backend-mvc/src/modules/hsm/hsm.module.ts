import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// Services
import { HSMFileSigningService } from './services/hsm-file-signing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [],
  providers: [HSMFileSigningService],
  exports: [HSMFileSigningService],
})
export class HsmModule {}
