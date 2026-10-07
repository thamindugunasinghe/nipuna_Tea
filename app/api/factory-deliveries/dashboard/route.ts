import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { round2 } from '@/lib/billing';
import { runChecks, DeliveryForCheck } from '@/lib/factoryChecks';
import { DELIVERY_INCLUDE } from '@/lib/factoryDeliveries';

// GET ?month=10&year=2026 — deliveries of that calendar month with automatic checks,
// a summary per factory, rising trends and deliveries still waiting for their card.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive
  // Earlier months are loaded too, so each factory's "normal" can be learned
  const historyStart = new Date(Date.UTC(year, month - 6, 1));

  const deliveries = await prisma.factoryDelivery.findMany({
    where: { deliveryDate: { gte: historyStart, lt: monthEnd } },
    include: DELIVERY_INCLUDE,
    orderBy: [{ deliveryDate: 'asc' }, { id: 'asc' }],
  });

  const forCheck: DeliveryForCheck[] = deliveries.map(d => ({
    id: d.id,
    deliveryDate: d.deliveryDate,
    factoryId: d.factoryId,
    factoryName: d.factory.name,
    transport: d.transport,
    teaSentKg: d.teaSentKg,
    cardReceivedKg: d.cardReceivedKg,
    cardDeductions: (d.cardDeductions as Record<string, number> | null) ?? null,
    dismissed: !!d.flagDismissedReason,
  }));

  // Trends are judged as of today (or the end of the chosen month, if it is in the past)
  const asOf = new Date(Math.min(Date.now(), monthEnd.getTime() - 1));
  const { results, trends, missingCards } = runChecks(forCheck, asOf);

  const inMonth = deliveries
    .filter(d => d.deliveryDate >= monthStart)
    .map(d => ({ ...d, check: results.get(d.id) ?? null }));

  // Summary per factory for the month
  const summary = new Map<number, any>();
  for (const d of inMonth) {
    const s = summary.get(d.factoryId) || {
      factoryId: d.factoryId, factoryName: d.factory.name, deliveries: 0, sentKg: 0,
      cardsIn: 0, sentWithCardKg: 0, receivedKg: 0, deductionKg: 0, acceptedKg: 0, flagged: 0, learning: false,
    };
    s.deliveries++;
    s.sentKg += d.teaSentKg;
    if (d.cardReceivedKg != null) {
      s.cardsIn++;
      s.sentWithCardKg += d.teaSentKg;
      s.receivedKg += d.cardReceivedKg;
      s.deductionKg += d.cardTotalDeduction ?? 0;
      s.acceptedKg += d.cardAcceptedKg ?? 0;
    }
    if (d.check?.flags.length && !d.flagDismissedReason) s.flagged++;
    if (d.check?.learning) s.learning = true;
    summary.set(d.factoryId, s);
  }
  const factories = [...summary.values()].map(s => ({
    ...s,
    sentKg: round2(s.sentKg),
    receivedKg: round2(s.receivedKg),
    deductionKg: round2(s.deductionKg),
    acceptedKg: round2(s.acceptedKg),
    transportLossKg: round2(s.sentWithCardKg - s.receivedKg),
    transportLossPct: s.sentWithCardKg > 0 ? round2(((s.sentWithCardKg - s.receivedKg) / s.sentWithCardKg) * 100) : null,
    deductionPct: s.receivedKg > 0 ? round2((s.deductionKg / s.receivedKg) * 100) : null,
    trend: trends.find(t => t.factoryId === s.factoryId) ?? null,
  })).sort((a, b) => a.factoryName.localeCompare(b.factoryName));

  // Missing cards across all time (not only this month)
  const waitingCards = await prisma.factoryDelivery.findMany({
    where: { cardReceivedKg: null },
    include: DELIVERY_INCLUDE,
    orderBy: { deliveryDate: 'asc' },
  });

  return NextResponse.json({
    deliveries: inMonth.reverse(), // newest first
    factories,
    trends,
    overdueCards: waitingCards.filter(d => missingCards.includes(d.id) || d.deliveryDate < new Date(Date.now() - 3 * 86400000)),
    totals: {
      deliveries: inMonth.length,
      sentKg: round2(inMonth.reduce((s, d) => s + d.teaSentKg, 0)),
      flagged: inMonth.filter(d => d.check?.flags.length && !d.flagDismissedReason).length,
      waitingCards: waitingCards.length,
    },
  });
}
