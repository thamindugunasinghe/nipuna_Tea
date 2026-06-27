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

  const totalDriverKilos = collections.reduce((sum, c) => sum + c.kilosByDriver, 0);
  const allValidated = collections.length > 0 && collections.every(c => c.kilosValidated != null);

  // Check if a validation record already exists (warehouse uses lorryId=0 convention in validation table)
  let existingValidation = null;
  if (!isWarehouse) {
    existingValidation = await prisma.lorryValidation.findUnique({
      where: { lorryId_validationDate: { lorryId, validationDate: dateStart } },
    });
  }

  return NextResponse.json({
    collections,
    totalDriverKilos,
    collectionsCount: collections.length,
    allValidated,
    existingValidation,
    isWarehouse,
  });
}

// POST: Perform smart validation — distribute weight loss based on water scores
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lorryId, date, warehouseKilos, warehouse } = body;

  if ((!lorryId && !warehouse) || !date || warehouseKilos === undefined) {
    return NextResponse.json({ error: 'lorryId (or warehouse), date, and warehouseKilos are required' }, { status: 400 });
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

  const totalDriverKilos = collections.reduce((sum, c) => sum + c.kilosByDriver, 0);
  const actualWarehouseKilos = parseFloat(warehouseKilos);
  const totalLoss = Math.max(0, totalDriverKilos - actualWarehouseKilos);

  // === SMART WATER-WEIGHT DEDUCTION ALGORITHM ===
  // Calculate weighted scores: kilos × waterScore
  const weightedScores = collections.map(c => ({
    id: c.id,
    kilos: c.kilosByDriver,
    waterScore: c.waterScore,
    weightedScore: c.kilosByDriver * c.waterScore,
  }));

  const totalWeightedScore = weightedScores.reduce((sum, w) => sum + w.weightedScore, 0);

  // Calculate deductions
  const deductions = weightedScores.map(w => {
    let deduction: number;

    if (totalLoss === 0) {
      // No loss — no deduction for anyone
      deduction = 0;
    } else if (totalWeightedScore > 0) {
      // Normal case: distribute loss proportionally based on weighted scores
      // Score 0 customers → weightedScore = 0 → deduction = 0 ✅
      deduction = (w.weightedScore / totalWeightedScore) * totalLoss;
    } else {
      // Fallback: ALL customers have score 0 but loss exists
      // Distribute proportionally by weight
      deduction = (w.kilos / totalDriverKilos) * totalLoss;
    }

    return {
      id: w.id,
      kilos: w.kilos,
      waterScore: w.waterScore,
      deduction: Math.round(deduction * 100) / 100, // round to 2 decimals
      validatedKilos: Math.round((w.kilos - deduction) * 100) / 100,
    };
  });

  // Update each collection with validated kilos
  for (const d of deductions) {
    await prisma.teaCollection.update({
      where: { id: d.id },
      data: { kilosValidated: d.validatedKilos },
    });
  }

  // Create/update validation record (skip for warehouse — warehouse collections validated directly)
  let validation = null;
  if (!isWarehouse) {
    validation = await prisma.lorryValidation.upsert({
      where: { lorryId_validationDate: { lorryId: parseInt(lorryId), validationDate: dateStart } },
      update: {
        totalDriverKilos,
        totalWarehouseKilos: actualWarehouseKilos,
        weightLoss: totalLoss,
        collectionsCount: collections.length,
      },
      create: {
        lorryId: parseInt(lorryId),
        validationDate: dateStart,
        totalDriverKilos,
        totalWarehouseKilos: actualWarehouseKilos,
        weightLoss: totalLoss,
        collectionsCount: collections.length,
      },
    });
  }

  return NextResponse.json({
    validation,
    deductions,
    totalDriverKilos,
    totalWarehouseKilos: actualWarehouseKilos,
    totalLoss,
  });
}
