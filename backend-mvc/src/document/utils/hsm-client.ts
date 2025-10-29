import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const HSM_URL = process.env.HSM_URL || 'http://localhost:3002';
// Important: Must match HSM middleware default (auth.middleware.js)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const HSM_MOCK_MODE = process.env.HSM_MOCK_MODE === 'true';

/**
 * HSM Client for communication with HSM service
 * Handles key generation, signing, and verification operations
 */
export class HsmClient {
  /**
   * Generate JWT token for HSM authentication
   */
  private static getToken(): string {
    // Must match HSM JWT_SECRET from .env - use the same secret as HSM service
    const hsmJwtSecret =
      process.env.HSM_JWT_SECRET ||
      process.env.JWT_SECRET ||
      'your-super-secret-jwt-key-change-in-production';

    return jwt.sign(
      {
        // HSM controller expects req.user.id
        id: 'backend-service',
        username: 'backend-service',
        role: 'service',
        service: 'digital-signature',
      },
      hsmJwtSecret,
      { expiresIn: '1h' },
    );
  }

  /**
   * Sign hash with HSM using CMS/PKCS#7 format
   * @param hash - SHA-256 hash to sign
   * @param keyId - HSM key ID to use for signing
   * @returns Base64-encoded CMS signature
   */
  static async signHash(hash: string, keyId: string): Promise<string> {
    try {
      const token = this.getToken();

      console.log('🔑 Calling HSM to sign hash...');
      console.log('HSM URL:', HSM_URL);
      console.log('Key ID:', keyId);
      console.log('Hash:', hash.substring(0, 16) + '...');
      console.log('Mock Mode:', HSM_MOCK_MODE);

      // Check if HSM is available
      const isHSMAvailable = await this.checkHSMHealth();

      if (!isHSMAvailable && !HSM_MOCK_MODE) {
        console.warn('⚠️  HSM not available, falling back to mock mode');
        return this.mockSignHash(hash, keyId);
      }

      const response = await axios.post(
        `${HSM_URL}/hsm/sign/cms`,
        {
          keyId,
          data: hash,
          certificateChain: [],
          signerInfo: {
            name: 'Digital Signature Service',
            organization: 'Backend MVC',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'HSM signing failed');
      }

      const signature = response.data.data.signature;
      console.log(
        '✅ HSM signature received:',
        signature.substring(0, 50) + '...',
      );

      return signature;
    } catch (error: any) {
      console.error('❌ HSM Client Error:', error.message);

      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }

      // Fallback to mock if HSM fails
      if (HSM_MOCK_MODE || error.code === 'ECONNREFUSED') {
        console.warn('⚠️  Using mock signature due to HSM error');
        return this.mockSignHash(hash, keyId);
      }

      throw new Error(`HSM signing failed: ${error.message}`);
    }
  }

  /**
   * Mock signing function (for development/testing)
   */
  private static mockSignHash(hash: string, keyId: string): string {
    console.log('🎭 Using MOCK signature (development mode)');

    const crypto = require('crypto');
    const mockSignature = {
      version: 1,
      digestAlgorithm: 'SHA256',
      signatureAlgorithm: 'RSA-2048',
      signature: crypto
        .createHash('sha256')
        .update(keyId + hash + Date.now())
        .digest('base64'),
      timestamp: new Date().toISOString(),
      mode: 'MOCK',
    };

    return Buffer.from(JSON.stringify(mockSignature)).toString('base64');
  }

  /**
   * Verify signature with HSM
   * @param hash - Original hash
   * @param signature - Signature to verify
   * @param keyId - Key ID used for signing
   * @returns Verification result
   */
  static async verifySignature(
    hash: string,
    signature: string,
    keyId: string,
  ): Promise<boolean> {
    try {
      const token = this.getToken();

      const response = await axios.post(
        `${HSM_URL}/hsm/verify`,
        {
          keyId,
          data: hash,
          signature,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      return response.data.data.verified;
    } catch (error: any) {
      console.error('HSM verification error:', error.message);
      return false;
    }
  }

  /**
   * Generate new key pair in HSM
   * @param userId - User ID to associate with the key
   * @returns Key information
   */
  static async generateKey(userId: string): Promise<any> {
    try {
      const token = this.getToken();

      const response = await axios.post(
        `${HSM_URL}/hsm/keys/generate`,
        {
          keyType: 'RSA',
          keySize: 2048,
          keyLabel: `Key for user ${userId}`,
          keyUsage: ['sign', 'verify'],
          metadata: {
            userId,
            createdBy: 'backend-service',
            timestamp: new Date().toISOString(),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      console.log('✅ Key generated:', response.data.data.keyId);
      return response.data.data;
    } catch (error: any) {
      console.error('Key generation error:', error.message);
      throw error;
    }
  }

  /**
   * Check HSM service health
   * @returns Health status
   */
  static async checkHSMHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${HSM_URL}/hsm/status`, {
        timeout: 5000,
      });
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get HSM status information
   * @returns Status information
   */
  static async getStatus(): Promise<any> {
    try {
      const token = this.getToken();

      const response = await axios.get(`${HSM_URL}/hsm/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: 'HSM service unavailable',
        error: error.message,
      };
    }
  }

  /**
   * List keys from HSM
   * @param userId - User ID to filter keys
   * @returns List of keys
   */
  static async listKeys(userId?: string): Promise<any> {
    try {
      const token = this.getToken();

      const response = await axios.get(`${HSM_URL}/hsm/keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: userId ? { userId } : {},
        timeout: 10000,
      });

      return response.data.data;
    } catch (error: any) {
      console.error('List keys error:', error.message);
      throw error;
    }
  }
}
