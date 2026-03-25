import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-prod';

/**
 * Encrypts a video ID
 */
export function encryptVideoId(videoId: string): string {
  const encrypted = CryptoJS.AES.encrypt(videoId, SECRET_KEY);
  // URL-safe base64
  return encrypted.toString()
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decrypts an encrypted video ID
 */
export function decryptVideoId(encryptedId: string): string | null {
  try {
    // Convert URL-safe base64 back to standard base64
    let base64 = encryptedId.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }

    const decrypted = CryptoJS.AES.decrypt(base64, SECRET_KEY);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}
