import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Fetch all unpaid non-regular collections
export async function GET() {
  try {
    const collections = await prisma.teaCollection.findMany({
      where: {
        customer: { type: 'non-regular' },
        instantPaid: false,
      },
      include: {
        customer: {
          select: { name: true, phone: true, customerId: true }
        }
      },
      orderBy: { collectionDate: 'desc' },
    });
    
    // Add calculated net kilos
    const processed = collections.map(c => ({
      ...c,
      netKilos: c.kilosByDriver - (c.waterDeduction || 0)
    }));

    return NextResponse.json(processed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}

// POST: Mark a collection as paid
export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    const collection = await prisma.teaCollection.update({
      where: { id: parseInt(id) },
      data: {
        instantPaid: true,
        instantPaidAt: new Date(),
      },
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
