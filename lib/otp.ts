import crypto from 'crypto';
import prisma from './prisma';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash('sha256').update(`${process.env.NEXTAUTH_SECRET}:${code}`).digest('hex');
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export type CreateOtpResult =
  | { ok: true; code: string }
  | { ok: false; retryAfterSec: number };

// Creates (or replaces) the OTP for a key. Refuses if one was issued less than a minute ago.
export async function createOtp(key: string, driverId?: number): Promise<CreateOtpResult> {
  const existing = await prisma.otpCode.findUnique({ where: { key } });
  if (existing) {
    const elapsed = Date.now() - existing.createdAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return { ok: false, retryAfterSec: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) };
    }
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const data = {
    codeHash: hashCode(code),
    driverId: driverId ?? null,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    createdAt: new Date(),
  };
  await prisma.otpCode.upsert({ where: { key }, update: data, create: { key, ...data } });
  return { ok: true, code };
}

export type VerifyOtpResult =
  | { ok: true; driverId: number | null; viaMaster: boolean }
  | { ok: false; reason: 'none' | 'expired' | 'locked' | 'invalid' };

// Checks a code. The master code (if given) is accepted in place of the issued one,
// but only while an OTP request is open, so it is covered by the same attempt limit.
export async function verifyOtp(key: string, code: string, masterCode?: string): Promise<VerifyOtpResult> {
  const stored = await prisma.otpCode.findUnique({ where: { key } });
  if (!stored) return { ok: false, reason: 'none' };

  if (stored.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };

  const input = String(code).trim();
  const viaMaster = !!masterCode && safeEqual(input, masterCode);

  if (!viaMaster && Date.now() > stored.expiresAt.getTime()) {
    await prisma.otpCode.delete({ where: { key } }).catch(() => {});
    return { ok: false, reason: 'expired' };
  }

  if (viaMaster || safeEqual(hashCode(input), stored.codeHash)) {
    await prisma.otpCode.delete({ where: { key } }).catch(() => {});
    return { ok: true, driverId: stored.driverId, viaMaster };
  }

  await prisma.otpCode.update({ where: { key }, data: { attempts: { increment: 1 } } });
  return { ok: false, reason: stored.attempts + 1 >= MAX_ATTEMPTS ? 'locked' : 'invalid' };
}
