import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const settings = await prisma.settings.findMany();
  const mapped: Record<string, string> = {};
  settings.forEach(s => { mapped[s.key] = s.value; });
  return NextResponse.json(mapped);
}

// All settings are numbers used in payment/commission maths
const NUMERIC_KEYS = new Set([
  'tea_price_per_kilo',
  'commission_rate',
  'transport_cost_per_kilo',
  'stamp_cost_per_kilo',
  'other_deduction_pct',
  'other_deduction_rate',
  'delivery_commission_per_kg',
]);

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  }

  // Unknown keys are ignored; known ones must be a number >= 0 (empty would break bills)
  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!NUMERIC_KEYS.has(key)) continue;
    const str = String(value).trim();
    const num = Number(str);
    if (str === '' || !Number.isFinite(num) || num < 0) {
      return NextResponse.json({ error: `Invalid value for ${key}: must be a number 0 or more` }, { status: 400 });
    }
    entries.push([key, str]);
  }

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  return NextResponse.json({ success: true });
}
