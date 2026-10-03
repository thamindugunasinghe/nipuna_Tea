import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { instantBreakdown, numSetting } from '@/lib/billing';

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
      netKilos: c.kilosValidated ?? (c.kilosByDriver - (c.waterDeduction || 0) - (c.packagingDeduction || 0))
    }));

    return NextResponse.json(processed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
  }
}

// POST: Pay a collection. The amount is calculated here (same maths as the page preview)
// and saved on the collection, so receipts can be reprinted exactly later.
export async function POST(req: NextRequest) {
  try {
    const { id, pricePerKilo } = await req.json();
    const collectionId = parseInt(id);
    const price = Number(pricePerKilo);

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Price per kilo must be a number greater than 0' }, { status: 400 });
    }

    const [collection, settings] = await Promise.all([
      prisma.teaCollection.findUnique({ where: { id: collectionId }, include: { customer: { select: { type: true } } } }),
      prisma.settings.findMany({
        where: { key: { in: ['transport_cost_per_kilo', 'stamp_cost_per_kilo', 'other_deduction_pct'] } },
      }),
    ]);

    if (!collection || collection.customer.type !== 'non-regular') {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const setting = (key: string, def: number) => numSetting(settings.find(x => x.key === key)?.value, def);
    const netKilos = collection.kilosValidated ?? (collection.kilosByDriver - (collection.waterDeduction || 0) - (collection.packagingDeduction || 0));
    const b = instantBreakdown(netKilos, collection.lorryId !== null, price, {
      transportCostPerKilo: setting('transport_cost_per_kilo', 6),
      stampCostPerKilo: setting('stamp_cost_per_kilo', 0),
      otherDeductionPct: setting('other_deduction_pct', 5),
    });

    // Only pays if still unpaid, so a double click can't pay twice
    const updated = await prisma.teaCollection.updateMany({
      where: { id: collectionId, instantPaid: false },
      data: {
        instantPaid: true,
        instantPaidAt: new Date(),
        instantPricePerKilo: price,
        instantGrossPay: b.grossPay,
        instantTransport: b.transportTotal,
        instantStamp: b.stampTotal,
        instantOther: b.otherTotal,
        instantNetPay: b.finalPayment,
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'This collection is already paid.' }, { status: 409 });
    }

    return NextResponse.json({ id: collectionId, netKilos, pricePerKilo: price, ...b });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
