import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone, signDriverToken } from '@/lib/driverAuth';
import { verifyOtp } from '@/lib/otp';

const ERRORS = {
  none: 'No OTP requested. Please try again. / OTP ඉල්ලා නැත. නැවත උත්සාහ කරන්න.',
  expired: 'OTP expired. Please request a new one. / OTP කල් ඉකුත්වී ඇත.',
  locked: 'Too many wrong attempts. Please request a new OTP. / වැරදි උත්සාහ වැඩියි. නව OTP එකක් ඉල්ලන්න.',
  invalid: 'Invalid OTP. Please try again. / වැරදි OTP. නැවත උත්සාහ කරන්න.',
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, otp } = body;

  if (!phone || !otp) {
    return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 });
  }

  const phoneKey = normalizePhone(String(phone));

  // Master OTP (DRIVER_MASTER_OTP in .env) is accepted in place of the SMS code
  const masterOtp = process.env.DRIVER_MASTER_OTP?.trim() || undefined;
  const result = await verifyOtp(`driver:${phoneKey}`, otp, masterOtp);

  if (!result.ok) {
    return NextResponse.json({ error: ERRORS[result.reason] }, { status: result.reason === 'locked' ? 429 : 400 });
  }

  const driver = result.driverId
    ? await prisma.driver.findUnique({ where: { id: result.driverId }, include: { lorry: true } })
    : null;

  if (!driver || !driver.active) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  console.log(
    result.viaMaster
      ? `[DRIVER AUTH] Master OTP used for ${phoneKey} - Driver ${driver.name} (ID: ${driver.id})`
      : `[DRIVER AUTH] Driver ${driver.name} (ID: ${driver.id}) logged in successfully`
  );

  return NextResponse.json({
    success: true,
    token: signDriverToken(driver.id),
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      lorryId: driver.lorryId,
      lorryNumber: driver.lorry?.lorryNumber || null,
    },
  });
}
