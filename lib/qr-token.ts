import { marieDB } from './db';

export function generateShortToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function createQRToken(outreachPropertyId: string): Promise<string> {
  let token = generateShortToken();
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      const result = await marieDB.query(
        `INSERT INTO outreach_qr_tokens (token, outreach_property_id)
         VALUES ($1, $2)
         RETURNING token`,
        [token, outreachPropertyId]
      );
      return result.rows[0].token;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        token = generateShortToken();
        attempts++;
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique QR token after multiple attempts');
}

export async function getQRTokenForProperty(outreachPropertyId: string): Promise<string | null> {
  const result = await marieDB.query(
    `SELECT token FROM outreach_qr_tokens WHERE outreach_property_id = $1 LIMIT 1`,
    [outreachPropertyId]
  );

  if (result.rows.length > 0) {
    return result.rows[0].token;
  }

  return null;
}

export async function getOrCreateQRToken(outreachPropertyId: string): Promise<string> {
  const existing = await getQRTokenForProperty(outreachPropertyId);
  if (existing) {
    return existing;
  }

  return await createQRToken(outreachPropertyId);
}

export function buildQRUrl(token: string, baseUrl: string = 'https://nzmarie.com'): string {
  return `${baseUrl}/r/${token}`;
}
