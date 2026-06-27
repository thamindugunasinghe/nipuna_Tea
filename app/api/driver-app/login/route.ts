import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Use globalThis to survive Next.js hot reloads in dev
const globalForDriverOtp = globalThis as unknown as {
  __driverOtps?: Map<string, { code: string; expiresAt: number; driverId: number }>;
};

if (!globalForDriverOtp.__driverOtps) {
  globalForDriverOtp.__driverOtps = new Map();
}
const driverOtps = globalForDriverOtp.__driverOtps;

export function getDriverOtp(phone: string) {
  return driverOtps.get(phone) || null;
}

export function clearDriverOtp(phone: string) {
  driverOtps.delete(phone);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone } = body;

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
  }

  // Normalize phone: remove spaces, ensure format
  const normalizedPhone = phone.replace(/\s/g, '').replace(/^0/, '94');

  // Find driver by phone
  const driver = await prisma.driver.findFirst({
    where: {
      phone: { contains: phone.replace(/^0/, '').replace(/^94/, '') },
      active: true,
    },
    include: { lorry: true },
  });

  if (!driver) {
    return NextResponse.json({ error: 'Driver not found. Please register with admin first. / රියදුරු හමු නොවීය. කරුණාකර පළමුව ඇඩ්මින් සමඟ ලියාපදිංචි වන්න.' }, { status: 404 });
  }

  if (!driver.phone) {
    return NextResponse.json({ error: 'No phone number registered for this driver.' }, { status: 400 });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store with 5-minute expiry
  driverOtps.set(phone, {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    driverId: driver.id,
  });

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    // In dev mode, log OTP to console
    console.log(`[DRIVER OTP] OTP for ${phone}: ${otp}`);
    return NextResponse.json({
      success: true,
      driverId: driver.id,
      driverName: driver.name,
      message: 'OTP sent (dev mode - check console)',
      // Include OTP in dev for testing
      ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    });
  }

  try {
    // Format phone for SMS: ensure 94XXXXXXXXX format
    const smsPhone = driver.phone.replace(/\s/g, '').replace(/^0/, '94');

    const payload = {
      recipient: smsPhone,
      sender_id: 'TextLKDemo',
      type: 'plain',
      message: `Nipuna Tea Driver App - Your login OTP is: ${otp}. Valid for 5 minutes. / ඔබගේ OTP: ${otp}`,
    };

    console.log(`[DRIVER OTP] Sending OTP to ${smsPhone}`);

    const smsResponse = await fetch('https://app.text.lk/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await smsResponse.text();
    console.log('[DRIVER OTP] SMS API response:', responseBody);

    if (responseBody.includes('error')) {
      console.error('[DRIVER OTP] SMS delivery failed:', responseBody);
      // Still allow login in dev
      return NextResponse.json({
        success: true,
        driverId: driver.id,
        driverName: driver.name,
        message: 'OTP generated (SMS delivery issue)',
        ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
      });
    }

    return NextResponse.json({
      success: true,
      driverId: driver.id,
      driverName: driver.name,
      message: 'OTP sent to your phone / OTP ඔබගේ දුරකථනයට එවන ලදී',
    });

  } catch (error) {
    console.error('[DRIVER OTP] Error:', error);
    return NextResponse.json({
      success: true,
      driverId: driver.id,
      driverName: driver.name,
      message: 'OTP generated',
      ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    });
  }
}
