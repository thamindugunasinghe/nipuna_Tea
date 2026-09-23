import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Fetch collections for a specific lorry + date (for validation)
// Also supports ?warehouse=true to get collections with no lorry (warehouse collections)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isWarehouse = searchParams.get('warehouse') === 'true';
  const lorryId = parseInt(searchParams.get('lorryId') || '0');
  const date = searchParams.get('date');

  if (!date || (!isWarehouse && !lorryId)) {
    return NextResponse.json({ error: 'lorryId (or warehouse=true) and date are required' }, { status: 400 });
  }

  // Parse date to match collection_date (start and end of day)
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const collections = await prisma.teaCollection.findMany({
    where: {
      lorryId: isWarehouse ? null : lorryId,
      collectionDate: { gte: dateStart, lte: dateEnd },
    },
    include: { customer: true, driver: true },
    orderBy: { id: 'asc' },
  });

  // Calculate totals
  const totalGrossKilos = collections.reduce((sum, c) => sum + c.kilosByDriver, 0);
  const totalWaterDeduction = collections.reduce((sum, c) => sum + (c.waterDeduction || 0), 0);
  const totalNetKilos = collections.reduce((sum, c) => sum + (c.kilosValidated || (c.kilosByDriver - (c.waterDeduction || 0))), 0);

  // Check if a validation record already exists
  const existingValidation = await prisma.lorryValidation.findFirst({
    where: { lorryId: isWarehouse ? null : lorryId, validationDate: dateStart },
  });

  // Check if there are collections added after validation (would need re-validation)
  const hasUnvalidatedCollections = existingValidation
    ? collections.some(c => new Date(c.createdAt) > new Date(existingValidation!.createdAt))
    : collections.length > 0;

  return NextResponse.json({
    collections,
    totalGrossKilos,
    totalWaterDeduction,
    totalNetKilos,
    collectionsCount: collections.length,
    existingValidation,
    hasUnvalidatedCollections,
    isWarehouse,
  });
}

// POST: Record lorry validation — compare cumulative net kilos vs lorry scale reading
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lorryId, date, lorryScaleKilos, warehouse } = body;

  if ((!lorryId && !warehouse) || !date || lorryScaleKilos === undefined) {
    return NextResponse.json({ error: 'lorryId (or warehouse), date, and lorryScaleKilos are required' }, { status: 400 });
  }

  const isWarehouse = warehouse === true;

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  // Get all collections for this lorry (or warehouse) on this date
  const collections = await prisma.teaCollection.findMany({
    where: {
      lorryId: isWarehouse ? null : parseInt(lorryId),
      collectionDate: { gte: dateStart, lte: dateEnd },
    },
    include: { customer: true },
  });

  if (collections.length === 0) {
    return NextResponse.json({ error: 'No collections found for this lorry/warehouse and date' }, { status: 400 });
  }

  // Calculate totals
  const totalGrossKilos = collections.reduce((sum, c) => sum + c.kilosByDriver, 0);
  const totalNetKilos = collections.reduce((sum, c) => sum + (c.kilosValidated || (c.kilosByDriver - (c.waterDeduction || 0))), 0);
  const actualLorryScaleKilos = parseFloat(lorryScaleKilos);

  // The key difference: lorry scale vs cumulative net kilos (after water deduction)
  const lorryCumulativeDiff = Math.round((actualLorryScaleKilos - totalNetKilos) * 100) / 100;

  // Ensure all collections have kilosValidated set (for old data that might not have it)
  for (const c of collections) {
    if (c.kilosValidated == null) {
      const netKilos = Math.round((c.kilosByDriver - (c.waterDeduction || 0)) * 100) / 100;
      await prisma.teaCollection.update({
        where: { id: c.id },
        data: { kilosValidated: netKilos },
      });
    }
  }

  // Create/update validation record (now also works for warehouse)
  const lorryIdValue = isWarehouse ? null : parseInt(lorryId);
  const existing = await prisma.lorryValidation.findFirst({
    where: { lorryId: lorryIdValue, validationDate: dateStart },
  });

  const validationData = {
    totalGrossKilos,
    totalDriverKilos: totalNetKilos,
    lorryScaleKilos: actualLorryScaleKilos,
    totalWarehouseKilos: actualLorryScaleKilos,
    lorryCumulativeDiff,
    weightLoss: Math.abs(lorryCumulativeDiff),
    collectionsCount: collections.length,
  };

  let validation;
  if (existing) {
    validation = await prisma.lorryValidation.update({
      where: { id: existing.id },
      data: validationData,
    });
  } else {
    validation = await prisma.lorryValidation.create({
      data: {
        lorryId: lorryIdValue,
        validationDate: dateStart,
        ...validationData,
      },
    });
  }

  // Build per-customer summary for response
  const customerSummary = collections.map(c => ({
    id: c.id,
    customerName: c.customer?.name,
    grossKilos: c.kilosByDriver,
    waterDeduction: c.waterDeduction || 0,
    netKilos: c.kilosValidated || (c.kilosByDriver - (c.waterDeduction || 0)),
  }));

  return NextResponse.json({
    validation,
    customerSummary,
    totalGrossKilos,
    totalNetKilos,
    lorryScaleKilos: actualLorryScaleKilos,
    lorryCumulativeDiff,
  });
}
