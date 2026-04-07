import { NextRequest, NextResponse } from 'next/server';

// In-memory OTP store (simple approach for single-instance)
let currentOtp: { code: string; expiresAt: number } | null = null;

export function getStoredOtp() {
  return currentOtp;
}

export function clearStoredOtp() {
  currentOtp = null;
}

export async function POST() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store with 5-minute expiry
  currentOtp = {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
  }

  try {
    const payload = {
      recipient: '94702111487',
      sender_id: 'TextLKDemo',
      type: 'plain',
      message: `Nipuna Tea - Your OTP code is: ${otp}. Valid for 5 minutes.`,
    };

    console.log('[OTP] Sending SMS with sender_id: TextLKDemo');

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
    console.log('[OTP] SMS API status:', smsResponse.status);
    console.log('[OTP] SMS API response:', responseBody);

    if (responseBody.includes('error')) {
      console.error('[OTP] SMS delivery failed:', responseBody);
      return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
    }

    console.log(`[OTP] Sent OTP ${otp} to +94702111487`);
    return NextResponse.json({ success: true, message: 'OTP sent to registered mobile number' });

  } catch (error) {
    console.error('[OTP] Error sending SMS:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
