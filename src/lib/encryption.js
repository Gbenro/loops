// Luna Loops - Client-side AES-256-GCM encryption
// Key never stored; derived from passphrase per session via PBKDF2

const VERIFY_PLAINTEXT = 'lunaloops-verify-v1';
const PBKDF2_ITERATIONS = 100000;

async function deriveKey(passphrase, userId) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(userId),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(plaintext, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  // Prepend IV to ciphertext, encode as base64
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertextB64, key) {
  const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// Generate a verify token by encrypting a known string — stored in profiles
export async function generateVerifyToken(passphrase, userId) {
  const key = await deriveKey(passphrase, userId);
  return encrypt(VERIFY_PLAINTEXT, key);
}

// Return the derived key if the token decrypts correctly, otherwise null
export async function unlockWithPassphrase(passphrase, userId, verifyToken) {
  try {
    const key = await deriveKey(passphrase, userId);
    const result = await decrypt(verifyToken, key);
    if (result === VERIFY_PLAINTEXT) return key;
    return null;
  } catch {
    return null;
  }
}

// Encrypt a plaintext string; returns base64 blob
export async function encryptText(plaintext, key) {
  if (!key || !plaintext) return plaintext;
  return encrypt(plaintext, key);
}

// Decrypt a base64 blob; returns plaintext. Returns original on failure.
export async function decryptText(ciphertextB64, key) {
  if (!key || !ciphertextB64) return ciphertextB64;
  try {
    return await decrypt(ciphertextB64, key);
  } catch {
    return '[encrypted]';
  }
}
