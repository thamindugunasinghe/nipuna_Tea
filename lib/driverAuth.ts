import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Compare phones by their last 9 digits so 07X..., 947X... and +94 7X... all match
export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(-9);
}

function sign(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
  return crypto.createHmac('sha256', `driver-app:${secret}`).update(payload).digest('base64url');
}

export function signDriverToken(driverId: number) {
  const payload = Buffer.from(JSON.stringify({ d: driverId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyDriverToken(token: string): number | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  try {
    const { d, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof d !== 'number' || typeof exp !== 'number' || Date.now() > exp) return null;
    return d;
  } catch {
    return null;
  }
}

// Returns the logged-in driver's id from the Authorization header, or null
export function getDriverId(req: NextRequest): number | null {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token ? verifyDriverToken(token) : null;
}

export function unauthorizedDriver() {
  return NextResponse.json(
    { error: 'Session expired. Please log in again. / කරුණාකර නැවත ලොග් වන්න.' },
    { status: 401 }
  );
}
