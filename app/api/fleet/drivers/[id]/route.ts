import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.driver.update({ where: { id: parseInt(id) }, data: { active: false } });
  return NextResponse.json({ success: true });
}
