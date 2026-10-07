import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';

const REASONS = ['rain', 'breakdown', 'delay', 'other'];

// Admin only (also enforced in proxy.ts).
// POST { reason: 'rain' | 'breakdown' | 'delay' | 'other', note? } — mark this delivery's flags as explained.
// Explained deliveries are not used when learning what is "normal".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const body = await req.json();

  if (!REASONS.includes(body.reason)) return NextResponse.json({ error: 'Please choose a reason' }, { status: 400 });
  const note = String(body.note ?? '').trim().slice(0, 200) || null;
  if (body.reason === 'other' && !note) return NextResponse.json({ error: 'Please type the reason' }, { status: 400 });

  try {
    const updated = await prisma.factoryDelivery.update({
      where: { id: parseInt(id) },
      data: {
        flagDismissedReason: body.reason,
        flagDismissedNote: note,
        flagDismissedBy: String(token?.name || token?.email || 'admin'),
        flagDismissedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }
}

// DELETE — undo (flags show again and the delivery is used for learning again)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const updated = await prisma.factoryDelivery.update({
      where: { id: parseInt(id) },
      data: { flagDismissedReason: null, flagDismissedNote: null, flagDismissedBy: null, flagDismissedAt: null },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }
}
