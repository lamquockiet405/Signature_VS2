import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { DatabaseService } from '../../database/database.service';
import { FilteredLogHelper } from '../../common/helpers/filtered-log.helper';

@Injectable()
export class TotpService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Setup TOTP for user - generate secret and QR code
   */
  async setupTotp(authToken: string) {
    try {
      console.log('🔐 Starting TOTP setup process');

      // Verify JWT token and get user info
      const decoded = this.jwtService.verify(authToken);
      const userId = decoded.sub || decoded.userId;
      const userEmail = decoded.email || decoded.username;

      if (!userId) {
        throw new HttpException(
          'Invalid token: user ID not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      console.log('👤 User ID:', userId, 'Email:', userEmail);

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `Digital Signature System (${userEmail})`,
        issuer: 'Digital Signature System',
        length: 32,
      });

      console.log('🔑 Generated TOTP secret (base32):', secret.base32);

      // Generate QR code
      if (!secret.otpauth_url) {
        throw new Error('Failed to generate OTP auth URL');
      }

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url, {
        type: 'image/png',
        width: 200,
        margin: 2,
      });

      console.log('📱 Generated QR code URL');

      // Save secret to database (not enabled yet)
      await this.databaseService.query(
        'UPDATE users SET totp_secret = $1, totp_enabled = false WHERE id = $2',
        [secret.base32, userId],
      );

      console.log('💾 Saved TOTP secret to database');

      // Log TOTP setup
      await FilteredLogHelper.logTotpOperation(this.databaseService, {
        userId: userId,
        action: 'TOTP_SETUP',
        description: `TOTP setup initiated for user ${userEmail}`,
        metadata: {
          userEmail,
          secretLength: secret.base32.length,
        },
      });

      return {
        secret: secret.base32,
        qrCodeUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url,
      };
    } catch (error) {
      console.error('❌ TOTP Setup error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to setup TOTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify TOTP token and enable TOTP for user
   */
  async verifyTotp(authToken: string, token: string) {
    try {
      console.log('🔐 Starting TOTP verification process');

      // Verify JWT token and get user info
      const decoded = this.jwtService.verify(authToken);
      const userId = decoded.sub || decoded.userId;

      if (!userId) {
        throw new HttpException(
          'Invalid token: user ID not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      console.log('👤 User ID:', userId, 'Token:', token);

      // Get user's TOTP secret from database
      const userResult = await this.databaseService.query(
        'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const user = userResult.rows[0];
      const secret = user.totp_secret;

      if (!secret) {
        throw new HttpException(
          'TOTP not set up. Please setup TOTP first.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (user.totp_enabled) {
        throw new HttpException(
          'TOTP is already enabled for this user',
          HttpStatus.BAD_REQUEST,
        );
      }

      console.log('🔑 Retrieved TOTP secret from database');

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2, // Allow 2 time steps (60 seconds) tolerance
      });

      if (!verified) {
        console.log('❌ TOTP verification failed');
        throw new HttpException('Invalid TOTP token', HttpStatus.BAD_REQUEST);
      }

      console.log('✅ TOTP verification successful');

      // Enable TOTP for user
      await this.databaseService.query(
        'UPDATE users SET totp_enabled = true WHERE id = $1',
        [userId],
      );

      console.log('🎉 TOTP enabled for user');

      // Log TOTP verification and enablement
      await FilteredLogHelper.logTotpOperation(this.databaseService, {
        userId: userId,
        action: 'TOTP_ENABLED',
        description: `TOTP successfully enabled for user ${userId}`,
        metadata: {
          verificationTime: new Date().toISOString(),
        },
      });

      return {
        enabled: true,
        message: 'TOTP enabled successfully',
      };
    } catch (error) {
      console.error('❌ TOTP Verification error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to verify TOTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify TOTP token for authentication (used during sign/approve)
   */
  async verifyTotpForAuth(userId: string, token: string): Promise<boolean> {
    try {
      console.log(
        '🔐 Verifying TOTP for authentication, User ID:',
        userId,
        'Token:',
        token,
      );

      // Get user's TOTP secret
      const userResult = await this.databaseService.query(
        'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const user = userResult.rows[0];

      if (!user.totp_enabled || !user.totp_secret) {
        throw new HttpException(
          'TOTP not enabled for this user',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });

      console.log('🔐 TOTP verification result:', verified);
      return verified;
    } catch (error) {
      console.error('❌ TOTP Auth verification error:', error);
      return false;
    }
  }

  /**
   * Get TOTP status for user
   */
  async getTotpStatus(authToken: string) {
    try {
      console.log('🔐 Getting TOTP status');

      // Verify JWT token and get user info
      const decoded = this.jwtService.verify(authToken);
      const userId = decoded.sub || decoded.userId;

      if (!userId) {
        throw new HttpException(
          'Invalid token: user ID not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get user TOTP status
      const userResult = await this.databaseService.query(
        'SELECT totp_enabled FROM users WHERE id = $1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const user = userResult.rows[0];

      return {
        isEnabled: user.totp_enabled || false,
      };
    } catch (error) {
      console.error('❌ Get TOTP status error:', error);
      throw new HttpException(
        error.message || 'Failed to get TOTP status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Disable TOTP for user
   */
  async disableTotp(authToken: string) {
    try {
      console.log('🔐 Disabling TOTP');

      // Verify JWT token and get user info
      const decoded = this.jwtService.verify(authToken);
      const userId = decoded.sub || decoded.userId;

      if (!userId) {
        throw new HttpException(
          'Invalid token: user ID not found',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Disable TOTP for user
      await this.databaseService.query(
        'UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1',
        [userId],
      );

      console.log('✅ TOTP disabled successfully for user:', userId);

      return {
        isEnabled: false,
      };
    } catch (error) {
      console.error('❌ Disable TOTP error:', error);
      throw new HttpException(
        error.message || 'Failed to disable TOTP',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if TOTP is enabled for user
   */
  async isTotpEnabled(userId: string): Promise<boolean> {
    try {
      const userResult = await this.databaseService.query(
        'SELECT totp_enabled FROM users WHERE id = $1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      return userResult.rows[0].totp_enabled || false;
    } catch (error) {
      console.error('❌ Check TOTP enabled error:', error);
      return false;
    }
  }
}
