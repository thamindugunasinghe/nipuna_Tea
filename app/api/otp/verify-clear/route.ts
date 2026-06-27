import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getStoredOtp, clearStoredOtp } from '../send/route';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { otp } = body;

  if (!otp) {
    return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
  }

  const stored = getStoredOtp();

  if (!stored) {
    return NextResponse.json({ error: 'No OTP was requested. Please request a new one.' }, { status: 400 });
  }

  if (Date.now() > stored.expiresAt) {
    clearStoredOtp();
    return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
  }

  if (otp !== stored.code) {
    return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
  }

  // OTP verified — clear all data
  clearStoredOtp();

  try {
    console.log('[CLEAR DATA] OTP verified. Clearing all database tables...');

    // Delete in order (respect foreign keys)
    await prisma.driverCommission.deleteMany();
    await prisma.monthlyPayment.deleteMany();
    await prisma.creditPurchase.deleteMany();
    await prisma.lorryValidation.deleteMany();
    await prisma.teaCollection.deleteMany();
    await prisma.fertiliser.deleteMany();
    await prisma.driverSession.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.lorry.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.user.deleteMany();

    // Re-create default admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: { username: 'admin', passwordHash, name: 'Administrator', role: 'admin' },
    });

    // Re-create default settings
    const defaultSettings = [
      { key: 'tea_price_per_kilo', value: '100' },
      { key: 'commission_rate', value: '5' },
      { key: 'other_deduction_rate', value: '5' },
    ];
    for (const s of defaultSettings) {
      await prisma.settings.create({ data: s });
    }

    console.log('[CLEAR DATA] All data cleared. Admin user recreated.');
    return NextResponse.json({ success: true, message: 'All data has been cleared successfully.' });

  } catch (error) {
    console.error('[CLEAR DATA] Error:', error);
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
