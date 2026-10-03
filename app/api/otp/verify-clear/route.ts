import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyOtp } from '@/lib/otp';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { otp } = body;

  if (!otp) {
    return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
  }

  const result = await verifyOtp('clear-data', otp);

  if (!result.ok) {
    const errors = {
      none: 'No OTP was requested. Please request a new one.',
      expired: 'OTP has expired. Please request a new one.',
      locked: 'Too many wrong attempts. Please request a new OTP.',
      invalid: 'Invalid OTP. Please try again.',
    };
    return NextResponse.json({ error: errors[result.reason] }, { status: 400 });
  }

  try {
    console.log('[CLEAR DATA] OTP verified. Clearing all database tables...');

    // Hash first (slow), then wipe and recreate defaults in one transaction:
    // if anything fails, nothing is deleted
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.$transaction(async (tx) => {
      // Delete in order (respect foreign keys)
      await tx.driverCommission.deleteMany();
      await tx.monthlyPayment.deleteMany();
      await tx.creditPurchase.deleteMany();
      await tx.lorryValidation.deleteMany();
      await tx.teaCollection.deleteMany();
      await tx.fertiliser.deleteMany();
      await tx.driverSession.deleteMany();
      await tx.driver.deleteMany();
      await tx.lorry.deleteMany();
      await tx.customer.deleteMany();
      await tx.settings.deleteMany();
      await tx.user.deleteMany();
      await tx.otpCode.deleteMany();

      // Re-create default admin user
      await tx.user.create({
        data: { username: 'admin', passwordHash, name: 'Administrator', role: 'admin' },
      });

      // Re-create default settings
      const defaultSettings = [
        { key: 'tea_price_per_kilo', value: '100' },
        { key: 'commission_rate', value: '5' },
        { key: 'other_deduction_rate', value: '5' },
      ];
      for (const s of defaultSettings) {
        await tx.settings.create({ data: s });
      }
    }, { timeout: 60000 });

    console.log('[CLEAR DATA] All data cleared. Admin user recreated.');
    return NextResponse.json({ success: true, message: 'All data has been cleared successfully.' });

  } catch (error) {
    console.error('[CLEAR DATA] Error:', error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
