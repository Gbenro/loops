import { describe, it, expect } from 'vitest';
import {
  generateVerifyToken,
  unlockWithPassphrase,
  encryptText,
  decryptText,
} from './encryption.js';

describe('encryption.js', () => {
  const testUserId = 'test-user-123';
  const testPassphrase = 'my-secret-passphrase';

  describe('generateVerifyToken', () => {
    it('generates a base64-encoded token', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // Base64 pattern
      expect(token).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('generates different tokens for different users', async () => {
      const token1 = await generateVerifyToken(testPassphrase, 'user-1');
      const token2 = await generateVerifyToken(testPassphrase, 'user-2');
      expect(token1).not.toBe(token2);
    });

    it('generates different tokens for different passphrases', async () => {
      const token1 = await generateVerifyToken('passphrase-1', testUserId);
      const token2 = await generateVerifyToken('passphrase-2', testUserId);
      expect(token1).not.toBe(token2);
    });

    it('generates different tokens each time due to random IV', async () => {
      const token1 = await generateVerifyToken(testPassphrase, testUserId);
      const token2 = await generateVerifyToken(testPassphrase, testUserId);
      // Tokens should be different due to random IV, but both should be valid
      expect(token1).not.toBe(token2);
    });
  });

  describe('unlockWithPassphrase', () => {
    it('returns a key for correct passphrase', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);
      expect(key).not.toBeNull();
      expect(key).toHaveProperty('algorithm');
    });

    it('returns null for incorrect passphrase', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase('wrong-passphrase', testUserId, token);
      expect(key).toBeNull();
    });

    it('returns null for incorrect userId', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, 'wrong-user', token);
      expect(key).toBeNull();
    });

    it('returns null for corrupted token', async () => {
      const key = await unlockWithPassphrase(testPassphrase, testUserId, 'corrupted-token');
      expect(key).toBeNull();
    });

    it('returns null for empty token', async () => {
      const key = await unlockWithPassphrase(testPassphrase, testUserId, '');
      expect(key).toBeNull();
    });
  });

  describe('encryptText and decryptText', () => {
    it('round-trips plaintext correctly', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      const plaintext = 'Hello, this is sensitive data!';
      const encrypted = await encryptText(plaintext, key);
      const decrypted = await decryptText(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext each time due to random IV', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      const plaintext = 'Same text';
      const encrypted1 = await encryptText(plaintext, key);
      const encrypted2 = await encryptText(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to same plaintext
      expect(await decryptText(encrypted1, key)).toBe(plaintext);
      expect(await decryptText(encrypted2, key)).toBe(plaintext);
    });

    it('returns original text when no key provided', async () => {
      const plaintext = 'Unencrypted text';
      const result = await encryptText(plaintext, null);
      expect(result).toBe(plaintext);
    });

    it('returns original text when no plaintext provided', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      const result = await encryptText(null, key);
      expect(result).toBeNull();

      const result2 = await encryptText('', key);
      expect(result2).toBe('');
    });

    it('returns ciphertext when no key for decryption', async () => {
      const ciphertext = 'some-encrypted-data';
      const result = await decryptText(ciphertext, null);
      expect(result).toBe(ciphertext);
    });

    it('returns [encrypted] marker when decryption fails', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      // Invalid ciphertext that looks like base64
      const invalidCiphertext = 'AAAAAAAAAAAAAAAAAAAAAA==';
      const result = await decryptText(invalidCiphertext, key);
      expect(result).toBe('[encrypted]');
    });

    it('handles unicode text correctly', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      const unicodeText = 'Hello 世界! Привет! 🌙✨';
      const encrypted = await encryptText(unicodeText, key);
      const decrypted = await decryptText(encrypted, key);

      expect(decrypted).toBe(unicodeText);
    });

    it('handles long text correctly', async () => {
      const token = await generateVerifyToken(testPassphrase, testUserId);
      const key = await unlockWithPassphrase(testPassphrase, testUserId, token);

      const longText = 'A'.repeat(10000);
      const encrypted = await encryptText(longText, key);
      const decrypted = await decryptText(encrypted, key);

      expect(decrypted).toBe(longText);
    });

    it('fails to decrypt with wrong key', async () => {
      const token1 = await generateVerifyToken('passphrase-1', testUserId);
      const key1 = await unlockWithPassphrase('passphrase-1', testUserId, token1);

      const token2 = await generateVerifyToken('passphrase-2', testUserId);
      const key2 = await unlockWithPassphrase('passphrase-2', testUserId, token2);

      const plaintext = 'Secret message';
      const encrypted = await encryptText(plaintext, key1);

      // Try to decrypt with wrong key
      const result = await decryptText(encrypted, key2);
      expect(result).toBe('[encrypted]');
    });
  });
});
