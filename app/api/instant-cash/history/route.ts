import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Fetch paid instant cash collections (History)
export async function GET() {
  try {
    const collections = await prisma.teaCollection.findMany({
      where: {
        customer: { type: 'non-regular' },
        instantPaid: true,
      },
      include: {
        customer: {
          select: { name: true, phone: true, customerId: true }
        }
      },
      orderBy: { instantPaidAt: 'desc' },
      take: 100, // Limit history to last 100 payments
    });
    
    const processed = collections.map(c => ({
      ...c,
      netKilos: c.kilosByDriver - (c.waterDeduction || 0)
    }));

    return NextResponse.json(processed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
