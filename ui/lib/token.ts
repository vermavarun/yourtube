import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-prod'
);

/**
 * Generates a short-lived JWT token for video access
 */
export async function generateVideoToken(
  encryptedVideoId: string,
  requestInfo?: { userAgent?: string; ip?: string }
): Promise<string> {
  const token = await new SignJWT({
    videoId: encryptedVideoId,
    ua: requestInfo?.userAgent || '',
    ip: requestInfo?.ip || '',
    nonce: Math.random().toString(36).substring(7)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m') // Token valid for 5 minutes
    .sign(SECRET_KEY);

  return token;
}

/**
 * Verifies a video access token
 */
export async function verifyVideoToken(token: string, expectedVideoId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload.videoId === expectedVideoId;
  } catch (error) {
    return false;
  }
}
