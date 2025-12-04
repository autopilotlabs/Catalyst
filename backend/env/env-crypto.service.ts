import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class EnvCryptoService {
  private readonly logger = new Logger(EnvCryptoService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly masterKey: Buffer;

  constructor() {
    const masterKeyHex = process.env.ENVVAR_MASTER_KEY;

    if (!masterKeyHex) {
      this.logger.error("ENVVAR_MASTER_KEY is not set! Environment variables will not be encrypted.");
      // Use a fallback key for development (DO NOT use in production)
      this.masterKey = Buffer.alloc(32, 0);
    } else {
      try {
        this.masterKey = Buffer.from(masterKeyHex, "hex");
        if (this.masterKey.length !== 32) {
          this.logger.error(
            `ENVVAR_MASTER_KEY must be 32 bytes (64 hex chars). Got ${this.masterKey.length} bytes.`
          );
          this.masterKey = Buffer.alloc(32, 0);
        }
      } catch (err) {
        this.logger.error(`Failed to parse ENVVAR_MASTER_KEY: ${err}`);
        this.masterKey = Buffer.alloc(32, 0);
      }
    }
  }

  /**
   * Encrypt a value using AES-256-GCM
   * Returns a Buffer containing: [iv (16 bytes)][authTag (16 bytes)][ciphertext]
   */
  encrypt(value: string): Buffer {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      let encrypted = cipher.update(value, "utf8");
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      // Combine: [iv][authTag][ciphertext]
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (err) {
      this.logger.error(`Encryption failed: ${err}`);
      throw new Error("Failed to encrypt value");
    }
  }

  /**
   * Decrypt a value using AES-256-GCM
   * Expects payload format: [iv (16 bytes)][authTag (16 bytes)][ciphertext]
   */
  decrypt(payload: Buffer): string {
    try {
      // Extract components
      const iv = payload.subarray(0, this.ivLength);
      const authTag = payload.subarray(
        this.ivLength,
        this.ivLength + this.authTagLength
      );
      const ciphertext = payload.subarray(this.ivLength + this.authTagLength);

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.masterKey,
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } catch (err) {
      this.logger.error(`Decryption failed: ${err}`);
      throw new Error("Failed to decrypt value");
    }
  }
}
