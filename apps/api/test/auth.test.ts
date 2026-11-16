import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken } from '../src/auth.js';

describe('Auth & Cryptography', () => {
  it('hashes passwords using Argon2id and verifies correctly', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);

    expect(hash).toContain('$argon2id$');
    const isValid = await verifyPassword(raw, hash);
    expect(isValid).toBe(true);

    const isWrong = await verifyPassword('WrongPassword', hash);
    expect(isWrong).toBe(false);
  });

  it('hashes session tokens with SHA-256 deterministically', () => {
    const token = 'abcdef1234567890abcdef1234567890';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex string length
  });
});