import prisma from './prisma';
import { numSetting, parseDay, round2 } from './billing';

export const DELIVERY_INCLUDE = {
  factory: { select: { id: true, name: true, deductionTypes: true } },
  lorry: { select: { id: true, lorryNumber: true } },
  driver: { select: { id: true, name: true } },
  driverCommission: { select: { id: true, paid: true, month: true, year: true } },
} as const;

// Rs. per kg paid to our driver for taking tea to a factory (Settings → delivery_commission_per_kg)
export async function deliveryCommissionRate() {
  const s = await prisma.settings.findUnique({ where: { key: 'delivery_commission_per_kg' } });
  return numSetting(s?.value, 1);
}

// Validate the "Send to Factory" form. Returns the fields to save, or an error message.
export async function parseDeliveryInput(body: any) {
  const deliveryDate = parseDay(body.deliveryDate);
  if (!deliveryDate) return { error: 'Please choose a valid date' };

  const factoryId = parseInt(body.factoryId);
  const factory = factoryId ? await prisma.factory.findUnique({ where: { id: factoryId } }) : null;
  if (!factory) return { error: 'Please choose a factory' };

  const transport = body.transport === 'factory' ? 'factory' : 'ours';
  let lorryId: number | null = null, driverId: number | null = null, factoryVehicleNo: string | null = null;
  if (transport === 'ours') {
    lorryId = parseInt(body.lorryId) || null;
    driverId = parseInt(body.driverId) || null;
    if (!lorryId || !driverId) return { error: 'Please choose our lorry and driver' };
    const [lorry, driver] = await Promise.all([
      prisma.lorry.findUnique({ where: { id: lorryId } }),
      prisma.driver.findUnique({ where: { id: driverId } }),
    ]);
    if (!lorry || !driver) return { error: 'Lorry or driver not found' };
  } else {
    factoryVehicleNo = String(body.factoryVehicleNo ?? '').trim().slice(0, 30) || null;
  }

  const handedOverKg = Number(body.handedOverKg);
  if (!Number.isFinite(handedOverKg) || handedOverKg <= 0) return { error: 'Weight handed over must be more than 0' };

  const gunnyBags = body.gunnyBags === true;
  const gunnyBagKg = gunnyBags ? Number(body.gunnyBagKg) : 0;
  if (gunnyBags && (!Number.isFinite(gunnyBagKg) || gunnyBagKg < 0 || gunnyBagKg >= handedOverKg)) {
    return { error: 'Gunny bag weight must be 0 or more and less than the weight handed over' };
  }

  return {
    data: {
      deliveryDate,
      factoryId,
      transport,
      lorryId,
      driverId,
      factoryVehicleNo,
      handedOverKg: round2(handedOverKg),
      gunnyBags,
      gunnyBagKg: round2(gunnyBagKg),
      teaSentKg: round2(handedOverKg - gunnyBagKg),
      note: String(body.note ?? '').trim().slice(0, 200) || null,
    },
  };
}
