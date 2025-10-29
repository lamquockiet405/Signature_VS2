import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    // Get full user info with permissions from database
    const userWithPermissions =
      await this.authService.getUserWithPermissions(userId);

    return {
      user: {
        id: userWithPermissions.id,
        username: userWithPermissions.username,
        email: userWithPermissions.email,
        full_name: userWithPermissions.full_name,
        role_name: userWithPermissions.role_name,
        role_description: userWithPermissions.role_description,
        is_super_admin: userWithPermissions.is_super_admin,
      },
      permissions: userWithPermissions.permissions,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard) // Chỉ cần JWT, không cần permissions
  async getProfile(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    // Get full user info with permissions from database
    const userWithPermissions =
      await this.authService.getUserWithPermissions(userId);

    return {
      id: userWithPermissions.id,
      username: userWithPermissions.username,
      email: userWithPermissions.email,
      full_name: userWithPermissions.full_name,
      phone: userWithPermissions.phone || null,
      avatar_url: userWithPermissions.avatar_url || null,
      role_name: userWithPermissions.role_name,
      role_description: userWithPermissions.role_description,
      is_super_admin: userWithPermissions.is_super_admin,
      totp_enabled: userWithPermissions.totp_enabled || false,
      created_at: userWithPermissions.created_at,
      updated_at: userWithPermissions.updated_at,
    };
  }

  @Get('check-permission')
  @UseGuards(JwtAuthGuard)
  async checkPermission(
    @Request() req: any,
    @Query('module') module: string,
    @Query('action') action: string,
  ) {
    const user = req.user;
    const permissions: string[] = user.permissions || [];
    const required = `${module.toLowerCase()}:${action.toLowerCase()}`;
    const allowed = permissions.includes('*') || permissions.includes(required);

    return {
      module,
      action,
      required,
      allowed,
      userPermissions: permissions,
    };
  }
}
