import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { UserId } from '../../common/decorators/user-id.decorator';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Controller('api/users')
@UseGuards(JwtAuthGuard, PermissionsGuard) // JWT first, then permissions
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('users', 'create')
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      message: 'User created successfully',
      user,
    };
  }

  @Get()
  @RequirePermission('users', 'read')
  async findAll(@Query() query: any) {
    return this.usersService.findAll(query);
  }

  @Get('stats/summary')
  @RequirePermission('users', 'read')
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('roles/list')
  @RequirePermission('users', 'read')
  async getRoles() {
    return this.usersService.getRoles();
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('users', 'update')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      message: 'User updated successfully',
      user,
    };
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  async remove(@Param('id') id: string, @UserId() currentUserId: string) {
    return this.usersService.remove(id, currentUserId);
  }

  // Avatar upload endpoints
  @Post(':id/avatar')
  @RequirePermission('users', 'update')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed!'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @Param('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.usersService.uploadAvatar(userId, file);
    return {
      message: 'Avatar uploaded successfully',
      ...result,
    };
  }

  @Delete(':id/avatar')
  @RequirePermission('users', 'update')
  async deleteAvatar(@Param('id') userId: string) {
    await this.usersService.deleteAvatar(userId);
    return {
      message: 'Avatar deleted successfully',
    };
  }
}
