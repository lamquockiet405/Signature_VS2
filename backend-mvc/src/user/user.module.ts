import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';

// Controllers
import { UsersController } from './controllers/users.controller';
import { PermissionsController } from './controllers/permisstion.controllers';
import { LogsController } from './controllers/logs.controller';

// Services
import { UsersService } from './services/users.service';
import {
  RolesService,
  PermissionsService,
} from './services/permisstions.service';
import { LogsService } from './services/logs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController, PermissionsController, LogsController],
  providers: [UsersService, RolesService, PermissionsService, LogsService],
  exports: [UsersService, RolesService, PermissionsService, LogsService],
})
export class UserModule {}
