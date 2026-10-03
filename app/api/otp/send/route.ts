import { NextResponse } from 'next/server';
import { createOtp } from '@/lib/otp';

export async function POST() {
  const created = await createOtp('clear-data');
  if (!created.ok) {
    return NextResponse.json({ error: `Please wait ${created.retryAfterSec}s before requesting a new OTP.` }, { status: 429 });
  }
  const otp = created.code;
  const isDev = process.env.NODE_ENV === 'development';

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    if (!isDev) {
      return NextResponse.json({ error: 'SMS is not configured. Cannot send OTP.' }, { status: 500 });
    }
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
      return NextResponse.json({ 
        error: errorMsg + ' (OTP logged to console)', 
        devOtp: isDev ? otp : undefined 
      }, { status: 500 });
    }

    console.log('[OTP] Sent clear-data OTP to +94702111487');
    return NextResponse.json({ success: true, message: 'OTP sent to registered mobile number' });

  } catch (error) {
    console.error('[OTP] Error sending SMS:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
