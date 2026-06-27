import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriverOtp, clearDriverOtp } from '../login/route';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, otp } = body;

  if (!phone || !otp) {
    return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 });
  }

  const stored = getDriverOtp(phone);

  if (!stored) {
    return NextResponse.json({ error: 'No OTP requested. Please try again. / OTP ඉල්ලා නැත. නැවත උත්සාහ කරන්න.' }, { status: 400 });
  }

  if (Date.now() > stored.expiresAt) {
    clearDriverOtp(phone);
    return NextResponse.json({ error: 'OTP expired. Please request a new one. / OTP කල් ඉකුත්වී ඇත.' }, { status: 400 });
  }

  if (otp !== stored.code) {
    return NextResponse.json({ error: 'Invalid OTP. Please try again. / වැරදි OTP. නැවත උත්සාහ කරන්න.' }, { status: 400 });
  }

  // OTP verified
  clearDriverOtp(phone);

  // Get driver info
  const driver = await prisma.driver.findUnique({
    where: { id: stored.driverId },
    include: { lorry: true },
  });

  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  console.log(`[DRIVER AUTH] Driver ${driver.name} (ID: ${driver.id}) logged in successfully`);

  return NextResponse.json({
    success: true,
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      lorryId: driver.lorryId,
      lorryNumber: driver.lorry?.lorryNumber || null,
    },
  });
}
