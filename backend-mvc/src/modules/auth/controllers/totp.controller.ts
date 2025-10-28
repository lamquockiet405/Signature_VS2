import { Controller, Post, Get, Body, Headers, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TotpService } from '../services/totp.service';
import { CreateTotpSetupDto, VerifyTotpDto } from '../dtos/totp.dto';

@Controller('api/auth/totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  /**
   * Setup TOTP for user
   * POST /api/auth/totp/setup
   */
  @Post('setup')
  @UseGuards(JwtAuthGuard)
  async setupTotp(@Headers('authorization') authHeader: string) {
    try {
      console.log('🔐 TOTP Setup request received');
      
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Authorization token required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.totpService.setupTotp(token);
      
      console.log('✅ TOTP Setup completed successfully');
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ TOTP Setup failed:', error);
      throw new HttpException(
        error.message || 'Failed to setup TOTP',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Verify TOTP token
   * POST /api/auth/totp/verify
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyTotp(
    @Headers('authorization') authHeader: string,
    @Body() verifyTotpDto: VerifyTotpDto
  ) {
    try {
      console.log('🔐 TOTP Verify request received for token:', verifyTotpDto.token);
      
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Authorization token required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.totpService.verifyTotp(token, verifyTotpDto.token);
      
      console.log('✅ TOTP Verify completed successfully');
      return {
        success: true,
        message: 'TOTP verified successfully',
        valid: result
      };
    } catch (error) {
      console.error('❌ TOTP Verify failed:', error);
      throw new HttpException(
        error.message || 'Failed to verify TOTP',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get TOTP status for user
   * GET /api/auth/totp/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getTotpStatus(@Headers('authorization') authHeader: string) {
    try {
      console.log('🔐 TOTP Status request received');
      
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Authorization token required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.totpService.getTotpStatus(token);
      
      console.log('✅ TOTP Status retrieved successfully');
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('❌ TOTP Status failed:', error);
      throw new HttpException(
        error.message || 'Failed to get TOTP status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Verify TOTP token for signing/approval (without enabling)
   * POST /api/auth/totp/verify-token
   */
  @Post('verify-token')
  @UseGuards(JwtAuthGuard)
  async verifyTokenForAction(
    @Headers('authorization') authHeader: string,
    @Body() verifyTotpDto: VerifyTotpDto
  ) {
    try {
      console.log('🔐 TOTP Verify Token request received for token:', verifyTotpDto.token);
      
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Authorization token required', HttpStatus.UNAUTHORIZED);
      }

      // Decode JWT to get user ID
      const decoded = this.totpService['jwtService'].verify(token);
      const userId = decoded.sub || decoded.userId;

      if (!userId) {
        throw new HttpException('Invalid token: user ID not found', HttpStatus.UNAUTHORIZED);
      }

      // Verify TOTP token for authentication
      const isValid = await this.totpService.verifyTotpForAuth(userId, verifyTotpDto.token);
      
      if (!isValid) {
        throw new HttpException('Invalid TOTP token', HttpStatus.BAD_REQUEST);
      }

      console.log('✅ TOTP Token verification successful');
      return {
        success: true,
        message: 'TOTP token verified successfully',
        valid: true
      };
    } catch (error) {
      console.error('❌ TOTP Token verification failed:', error);
      throw new HttpException(
        error.message || 'Failed to verify TOTP token',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Disable TOTP for user
   * POST /api/auth/totp/disable
   */
  @Post('disable')
  @UseGuards(JwtAuthGuard)
  async disableTotp(@Headers('authorization') authHeader: string) {
    try {
      console.log('🔐 TOTP Disable request received');
      
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        throw new HttpException('Authorization token required', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.totpService.disableTotp(token);
      
      console.log('✅ TOTP Disabled successfully');
      return {
        success: true,
        message: 'TOTP disabled successfully',
        data: result
      };
    } catch (error) {
      console.error('❌ TOTP Disable failed:', error);
      throw new HttpException(
        error.message || 'Failed to disable TOTP',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
