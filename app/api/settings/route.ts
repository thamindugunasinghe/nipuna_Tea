import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const settings = await prisma.settings.findMany();
  const mapped: Record<string, string> = {};
  settings.forEach(s => { mapped[s.key] = s.value; });
  return NextResponse.json(mapped);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const entries = Object.entries(body);
  for (const [key, value] of entries) {
    await prisma.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  return NextResponse.json({ success: true });
}
