import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HsmController } from './hsm.controller';
import { HsmService } from './hsm.service';
import { HsmKey } from '../entities/hsm-key.entity';
import { HsmSlot } from '../entities/hsm-slot.entity';
import { HsmLog } from '../entities/hsm-log.entity';
import { HsmSignedLog } from '../entities/hsm-signed-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HsmKey, HsmSlot, HsmLog, HsmSignedLog]),
  ],
  controllers: [HsmController],
  providers: [HsmService],
  exports: [HsmService],
})
export class HsmModule {}
