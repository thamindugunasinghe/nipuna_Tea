import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password, name, role } = body;

  if (!username || !password || !name) {
    return NextResponse.json({ error: 'Username, password, and name are required' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { username, passwordHash, name, role: role || 'staff' },
    });
    return NextResponse.json({ id: user.id, username: user.username, name: user.name, role: user.role }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
