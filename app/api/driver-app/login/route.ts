import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/driverAuth';
import { createOtp } from '@/lib/otp';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone } = body;

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
  }

  const phoneKey = normalizePhone(String(phone));
  if (phoneKey.length !== 9) {
    return NextResponse.json({ error: 'Invalid phone number / වැරදි දුරකථන අංකය' }, { status: 400 });
  }

  // Exact match on the last 9 digits (stored numbers may be 07X..., 947X... or +94 7X...)
  const drivers = await prisma.driver.findMany({
    where: { active: true, phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  const matches = drivers.filter(d => normalizePhone(d.phone!) === phoneKey);

  if (matches.length > 1) {
    return NextResponse.json({ error: 'This phone number is registered to more than one driver. Please contact admin.' }, { status: 409 });
  }
  const driver = matches[0];

  if (!driver) {
    return NextResponse.json({ error: 'Driver not found. Please register with admin first. / රියදුරු හමු නොවීය. කරුණාකර පළමුව ඇඩ්මින් සමඟ ලියාපදිංචි වන්න.' }, { status: 404 });
  }

  if (!driver.phone) {
    return NextResponse.json({ error: 'No phone number registered for this driver.' }, { status: 400 });
  }

  const created = await createOtp(`driver:${phoneKey}`, driver.id);
  if (!created.ok) {
    return NextResponse.json({
      error: `Please wait ${created.retryAfterSec}s before requesting a new OTP. / තත්පර ${created.retryAfterSec} කින් නැවත උත්සාහ කරන්න.`,
    }, { status: 429 });
  }
  const otp = created.code;

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    // In dev mode, log OTP to console
    if (process.env.NODE_ENV === 'development') console.log(`[DRIVER OTP] OTP for ${phoneKey}: ${otp}`);
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
