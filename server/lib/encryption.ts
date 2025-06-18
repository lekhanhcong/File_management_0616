import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { promisify } from 'util';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_ROUNDS = 12;

interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

interface DecryptionInput {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

class EncryptionService {
  private masterKey: Buffer;

  constructor(masterKey?: string) {
    // In production, this should come from environment variables or key management service
    const key = masterKey || process.env.ENCRYPTION_MASTER_KEY || 'default-key-change-in-production';
    this.masterKey = crypto.scryptSync(key, 'salt', KEY_LENGTH);
  }

  // Generate a new encryption key
  generateKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
  }

  // Generate initialization vector
  generateIV(): Buffer {
    return crypto.randomBytes(IV_LENGTH);
  }

  // Encrypt data with AES-256-GCM
  encrypt(data: string, key?: Buffer): EncryptionResult {
    try {
      const encryptionKey = key || this.masterKey;
      const iv = this.generateIV();
      const cipher = crypto.createCipher(ALGORITHM, encryptionKey);
      cipher.setAutoPadding(true);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt data with AES-256-GCM
  decrypt(input: DecryptionInput, key?: Buffer): string {
    try {
      const encryptionKey = key || this.masterKey;
      const decipher = crypto.createDecipher(ALGORITHM, encryptionKey);
      
      const iv = Buffer.from(input.iv, 'hex');
      const tag = Buffer.from(input.tag, 'hex');
      
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(input.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Encrypt file data
  async encryptFile(filePath: string, outputPath: string, key?: Buffer): Promise<EncryptionResult> {
    return new Promise((resolve, reject) => {
      try {
        const encryptionKey = key || this.masterKey;
        const iv = this.generateIV();
        const cipher = crypto.createCipher(ALGORITHM, encryptionKey);
        
        const input = crypto.createReadStream(filePath);
        const output = crypto.createWriteStream(outputPath);
        
        input.pipe(cipher).pipe(output);
        
        output.on('close', () => {
          const tag = cipher.getAuthTag();
          resolve({
            encrypted: outputPath,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
          });
        });
        
        output.on('error', reject);
        input.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Decrypt file data
  async decryptFile(input: DecryptionInput & { filePath: string }, outputPath: string, key?: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const encryptionKey = key || this.masterKey;
        const decipher = crypto.createDecipher(ALGORITHM, encryptionKey);
        
        const iv = Buffer.from(input.iv, 'hex');
        const tag = Buffer.from(input.tag, 'hex');
        
        decipher.setAuthTag(tag);
        
        const inputStream = crypto.createReadStream(input.filePath);
        const outputStream = crypto.createWriteStream(outputPath);
        
        inputStream.pipe(decipher).pipe(outputStream);
        
        outputStream.on('close', () => {
          resolve(outputPath);
        });
        
        outputStream.on('error', reject);
        inputStream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Hash password with bcrypt
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, SALT_ROUNDS);
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  // Verify password with bcrypt
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // Generate secure random token
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate UUID v4
  generateUUID(): string {
    return crypto.randomUUID();
  }

  // Create HMAC signature
  createSignature(data: string, secret?: string): string {
    const key = secret || process.env.HMAC_SECRET || 'default-hmac-secret';
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  // Verify HMAC signature
  verifySignature(data: string, signature: string, secret?: string): boolean {
    const expectedSignature = this.createSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Key derivation function (for deriving keys from passwords)
  deriveKey(password: string, salt: string): Buffer {
    return crypto.scryptSync(password, salt, KEY_LENGTH);
  }

  // Generate salt for key derivation
  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Data privacy utilities
class PrivacyService {
  private encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
  }

  // Anonymize PII data
  anonymizePII(data: any): any {
    const piiFields = ['email', 'phone', 'ssn', 'creditCard', 'address'];
    const anonymized = { ...data };

    for (const field of piiFields) {
      if (anonymized[field]) {
        anonymized[field] = this.maskData(anonymized[field]);
      }
    }

    return anonymized;
  }

  // Mask sensitive data
  private maskData(value: string): string {
    if (value.includes('@')) {
      // Email masking
      const [username, domain] = value.split('@');
      return `${username.charAt(0)}***@${domain}`;
    } else if (/^\d+$/.test(value)) {
      // Number masking (phone, SSN, etc.)
      return '*'.repeat(value.length - 4) + value.slice(-4);
    } else {
      // General text masking
      return value.charAt(0) + '*'.repeat(Math.max(0, value.length - 2)) + value.slice(-1);
    }
  }

  // Encrypt PII fields
  encryptPII(data: any, piiFields: string[] = []): any {
    const defaultPIIFields = ['email', 'phone', 'address', 'ssn'];
    const fieldsToEncrypt = piiFields.length > 0 ? piiFields : defaultPIIFields;
    const encrypted = { ...data };

    for (const field of fieldsToEncrypt) {
      if (encrypted[field]) {
        try {
          const encryptionResult = this.encryptionService.encrypt(encrypted[field]);
          encrypted[field] = JSON.stringify(encryptionResult);
          encrypted[`${field}_encrypted`] = true;
        } catch (error) {
          console.error(`Failed to encrypt field ${field}:`, error);
        }
      }
    }

    return encrypted;
  }

  // Decrypt PII fields
  decryptPII(data: any, piiFields: string[] = []): any {
    const defaultPIIFields = ['email', 'phone', 'address', 'ssn'];
    const fieldsToDecrypt = piiFields.length > 0 ? piiFields : defaultPIIFields;
    const decrypted = { ...data };

    for (const field of fieldsToDecrypt) {
      if (decrypted[field] && decrypted[`${field}_encrypted`]) {
        try {
          const encryptionData = JSON.parse(decrypted[field]);
          decrypted[field] = this.encryptionService.decrypt(encryptionData);
          delete decrypted[`${field}_encrypted`];
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    }

    return decrypted;
  }

  // Data retention compliance
  checkDataRetention(record: any, retentionPolicyDays: number): boolean {
    if (!record.createdAt) return false;
    
    const createdDate = new Date(record.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceCreation <= retentionPolicyDays;
  }

  // GDPR compliance - right to be forgotten
  rightToBeForgotten(userId: string, data: any[]): any[] {
    return data.map(record => {
      if (record.userId === userId || record.ownerId === userId) {
        return {
          ...record,
          personalData: '[REDACTED]',
          email: '[REDACTED]',
          name: '[REDACTED]',
          phone: '[REDACTED]',
          address: '[REDACTED]',
          gdprDeleted: true,
          deletedAt: new Date().toISOString(),
        };
      }
      return record;
    });
  }

  // Data export for GDPR compliance
  exportUserData(userId: string, data: any[]): any {
    const userData = data.filter(record => 
      record.userId === userId || record.ownerId === userId
    );

    return {
      userId,
      exportDate: new Date().toISOString(),
      dataType: 'personal_data_export',
      records: userData.map(record => this.decryptPII(record)),
    };
  }
}

// Secure token management
class TokenService {
  private encryptionService: EncryptionService;
  private tokenStore: Map<string, { data: any; expiresAt: number }>;

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
    this.tokenStore = new Map();
    
    // Cleanup expired tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
  }

  // Generate secure access token
  generateAccessToken(payload: any, expiresInMinutes = 60): string {
    const token = this.encryptionService.generateToken();
    const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
    
    this.tokenStore.set(token, {
      data: payload,
      expiresAt,
    });

    return token;
  }

  // Validate and retrieve token data
  validateToken(token: string): any | null {
    const tokenData = this.tokenStore.get(token);
    
    if (!tokenData) {
      return null;
    }

    if (Date.now() > tokenData.expiresAt) {
      this.tokenStore.delete(token);
      return null;
    }

    return tokenData.data;
  }

  // Revoke token
  revokeToken(token: string): boolean {
    return this.tokenStore.delete(token);
  }

  // Cleanup expired tokens
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, data] of this.tokenStore.entries()) {
      if (now > data.expiresAt) {
        this.tokenStore.delete(token);
      }
    }
  }

  // Generate refresh token
  generateRefreshToken(userId: string): string {
    const payload = {
      type: 'refresh',
      userId,
      issuedAt: Date.now(),
    };
    
    return this.generateAccessToken(payload, 24 * 60 * 7); // 7 days
  }

  // Generate password reset token
  generatePasswordResetToken(userId: string, email: string): string {
    const payload = {
      type: 'password_reset',
      userId,
      email,
      issuedAt: Date.now(),
    };
    
    return this.generateAccessToken(payload, 30); // 30 minutes
  }
}

// Global instances
export const encryptionService = new EncryptionService();
export const privacyService = new PrivacyService(encryptionService);
export const tokenService = new TokenService(encryptionService);

// Utility functions
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default {
  EncryptionService,
  PrivacyService,
  TokenService,
  encryptionService,
  privacyService,
  tokenService,
  hashSensitiveData,
  validatePasswordStrength,
};