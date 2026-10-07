import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Every /api route needs a logged-in dashboard user (some need admin, see below), except:
//  - /api/auth/*        NextAuth's own login endpoints
//  - /api/driver-app/*  driver app; those routes check the driver token themselves
//    (online-drivers is used by the dashboard, so it still needs a dashboard login)
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/\/+$/, '');

  if (path.startsWith('/api/auth/')) return NextResponse.next();
  if (path.startsWith('/api/driver-app/') && path !== '/api/driver-app/online-drivers') {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin-only: user management, clear-all-data OTP, and changing prices/rates
  const adminOnly =
    path === '/api/users' || path.startsWith('/api/users/') ||
    path.startsWith('/api/otp/') ||
    /^\/api\/factory-deliveries\/\d+\/dismiss$/.test(path) ||
    (path === '/api/settings' && req.method !== 'GET');
  if (adminOnly && token.role !== 'admin') {
    return NextResponse.json({ error: 'Only admin can do this / ඇඩ්මින්ට පමණි' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
