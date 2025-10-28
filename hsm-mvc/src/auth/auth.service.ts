import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(userId: string, username: string, role: string = 'user'): Promise<any> {
    // In a real application, you would validate the user against a database
    // For now, we'll just return the user object
    return {
      id: userId,
      username,
      role,
    };
  }

  async generateToken(user: any): Promise<string> {
    const payload = { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    };
    return this.jwtService.sign(payload);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
