import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT Strategy - validates JWT tokens and extracts payload
 * This strategy is used by JwtAuthGuard to protect routes
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Tokens MUST NOT be expired
      secretOrKey:
        process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-in-production',
    });
  }

  /**
   * Validate JWT payload
   * This method is called automatically after JWT is verified
   * The returned object is attached to request.user
   */
  async validate(payload: any) {
    if (!payload || !payload.userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user object with permissions
    // This will be available in request.user in all protected routes
    return {
      userId: payload.userId,
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      roleId: payload.roleId,
      permissions: payload.permissions || [], // ✅ Include permissions array
    };
  }
}
