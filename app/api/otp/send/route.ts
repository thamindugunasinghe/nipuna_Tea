import { NextRequest, NextResponse } from 'next/server';

// Use globalThis to survive Next.js hot reloads in dev
const globalForOtp = globalThis as unknown as {
  __clearDataOtp?: { code: string; expiresAt: number } | null;
};

export function getStoredOtp() {
  return globalForOtp.__clearDataOtp || null;
}

export function clearStoredOtp() {
  globalForOtp.__clearDataOtp = null;
}

export async function POST() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store with 5-minute expiry (on globalThis to survive hot reloads)
  globalForOtp.__clearDataOtp = {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    console.log(`[OTP] No API token configured. OTP code: ${otp}`);
    return NextResponse.json({ success: true, message: 'OTP generated (no SMS configured)', devOtp: otp });
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
      let errorMsg = 'Failed to send OTP';
      try {
        const parsed = JSON.parse(responseBody);
        if (parsed.message) errorMsg = parsed.message;
      } catch {}
      // Still return the OTP for dev/testing when SMS fails
      console.log(`[OTP] SMS failed but OTP generated: ${otp}`);
      return NextResponse.json({ 
        error: errorMsg + ' (OTP logged to console)', 
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined 
      }, { status: 500 });
    }

    console.log(`[OTP] Sent OTP ${otp} to +94702111487`);
    return NextResponse.json({ success: true, message: 'OTP sent to registered mobile number' });

  } catch (error) {
    console.error('[OTP] Error sending SMS:', error);
    console.log(`[OTP] Error but OTP generated: ${otp}`);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
