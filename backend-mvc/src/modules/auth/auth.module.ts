import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../../database/database.module';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { TotpController } from './controllers/totp.controller';
// Services
import { AuthService } from './services/auth.service';
import { TotpService } from './services/totp.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-in-production',
      signOptions: {
        expiresIn: '24h', // Token expires in 24 hours
      },
    }),
  ],
  controllers: [
    AuthController,
    TotpController,
  ],
  providers: [
    AuthService,
    TotpService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    TotpService,
    JwtStrategy,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}