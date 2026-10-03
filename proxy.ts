import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Every /api route needs a logged-in dashboard user, except:
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
