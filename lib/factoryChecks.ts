// Automatic anomaly checks for factory deliveries. No fixed limits: each factory's "normal"
// is learned from its own recent history, and compared with other factories on the same day.
//
//  1. Own normal  — this delivery vs the factory's last 30 deliveries (median; one bad day can't move it)
//  2. Same day    — vs other factories that day (weather affects everyone, fraud only one)
//  3. Deductions  — each deduction type (water, crates, ...) vs that factory's normal for it
//  4. Trend       — last 7 days vs the 30 days before (slow, creeping increases)
//
// Losses are compared separately for our lorry and the factory's own lorry.
// Deliveries whose flags an admin dismissed (rain, breakdown...) are not used for learning.

export interface DeliveryForCheck {
  id: number;
  deliveryDate: string | Date;
  factoryId: number;
  factoryName: string;
  transport: string; // 'ours' | 'factory'
  teaSentKg: number;
  cardReceivedKg: number | null;
  cardDeductions: Record<string, number> | null;
  dismissed: boolean;
}

export interface Flag {
  level: 'red' | 'amber';
  check: 'own' | 'peer' | 'deduction';
  message: string;
  extraKg: number; // kg above what would be normal
}

export interface DeliveryResult {
  id: number;
  transportLossKg: number | null;
  transportLossPct: number | null;
  deductionKg: number | null;
  deductionPct: number | null;
  usualLossPct: number | null; // factory's learned normal (null while learning)
  learning: boolean;
  flags: Flag[];
}

export interface TrendFlag {
  factoryId: number;
  factoryName: string;
  what: string;
  recentPct: number;
  usualPct: number;
}

const HISTORY = 30;        // deliveries used to learn "normal"
const MIN_HISTORY = 15;    // needed before the own-normal checks switch on
const MIN_PEERS = 2;       // other deliveries needed on the same day
const RED = 3.5, AMBER = 2.5; // robust z-score: how far outside normal
// Smallest spread used, so a very steady factory isn't flagged for tiny wobbles (percentage points)
const MIN_SPREAD_LOSS = 0.3, MIN_SPREAD_PEER = 0.75, MIN_SPREAD_DEDUCTION = 0.2;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Median and robust spread (scaled median absolute deviation)
function normalOf(xs: number[], minSpread: number) {
  const m = median(xs);
  const mad = median(xs.map(x => Math.abs(x - m)));
  return { median: m, spread: Math.max(1.4826 * mad, minSpread) };
}

function level(z: number): 'red' | 'amber' | null {
  return z >= RED ? 'red' : z >= AMBER ? 'amber' : null;
}

export function lossPct(d: DeliveryForCheck) {
  if (d.cardReceivedKg == null || d.teaSentKg <= 0) return null;
  return ((d.teaSentKg - d.cardReceivedKg) / d.teaSentKg) * 100;
}

function deductionPcts(d: DeliveryForCheck) {
  const out: Record<string, number> = {};
  if (d.cardReceivedKg == null || d.cardReceivedKg <= 0 || !d.cardDeductions) return out;
  for (const [name, kg] of Object.entries(d.cardDeductions)) {
    if (typeof kg === 'number' && Number.isFinite(kg)) out[name] = (kg / d.cardReceivedKg) * 100;
  }
  return out;
}

const transportLabel = (t: string) => (t === 'factory' ? "factory's lorry" : 'our lorry');

export function runChecks(all: DeliveryForCheck[], today = new Date()) {
  // Only deliveries with a factory card can be checked, oldest first
  const carded = all
    .filter(d => d.cardReceivedKg != null)
    .sort((a, b) => dayKey(a.deliveryDate).localeCompare(dayKey(b.deliveryDate)) || a.id - b.id);

  // Learned normal for a delivery = its group's earlier, non-dismissed deliveries
  const ownNormal = (index: number, group: (d: DeliveryForCheck) => boolean, value: (d: DeliveryForCheck) => number | null, minSpread: number) => {
    const before = carded.slice(0, index).filter(d => !d.dismissed && group(d))
      .map(value).filter((v): v is number => v != null).slice(-HISTORY);
    return before.length >= MIN_HISTORY ? normalOf(before, minSpread) : null;
  };

  const results = new Map<number, DeliveryResult>();

  carded.forEach((d, i) => {
    const loss = lossPct(d)!;
    const sameTransport = (x: DeliveryForCheck) => x.factoryId === d.factoryId && x.transport === d.transport;
    const own = ownNormal(i, sameTransport, lossPct, MIN_SPREAD_LOSS);
    const flags: Flag[] = [];

    // 1. Own normal
    if (own) {
      const lv = level((loss - own.median) / own.spread);
      if (lv) {
        flags.push({
          level: lv, check: 'own',
          extraKg: r1(((loss - own.median) / 100) * d.teaSentKg),
          message: `Transport loss ${r1(loss)}% — usual for ${d.factoryName} (${transportLabel(d.transport)}) is ${r1(own.median)}%`,
        });
      }
    }

    // 3. Each deduction type vs this factory's normal for it
    const pcts = deductionPcts(d);
    for (const [name, pct] of Object.entries(pcts)) {
      const n = ownNormal(i, x => x.factoryId === d.factoryId, x => deductionPcts(x)[name] ?? null, MIN_SPREAD_DEDUCTION);
      if (!n) continue;
      const lv = level((pct - n.median) / n.spread);
      if (lv) {
        flags.push({
          level: lv, check: 'deduction',
          extraKg: r1(((pct - n.median) / 100) * (d.cardReceivedKg as number)),
          message: `${name} deduction ${r1(pct)}% — usual for ${d.factoryName} is ${r1(n.median)}%`,
        });
      }
    }

    const deductionKg = d.cardDeductions ? Object.values(d.cardDeductions).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
    results.set(d.id, {
      id: d.id,
      transportLossKg: r2(d.teaSentKg - (d.cardReceivedKg as number)),
      transportLossPct: r2(loss),
      deductionKg: r2(deductionKg),
      deductionPct: (d.cardReceivedKg as number) > 0 ? r2((deductionKg / (d.cardReceivedKg as number)) * 100) : null,
      usualLossPct: own ? r2(own.median) : null,
      learning: !own,
      flags,
    });
  });

  // 2. Same-day comparison (works from day 1). Compare how far each delivery is above its own
  // normal when everyone has one (cancels distance/route differences), otherwise the raw loss.
  const byDay = new Map<string, DeliveryForCheck[]>();
  for (const d of carded) {
    const k = dayKey(d.deliveryDate);
    byDay.set(k, [...(byDay.get(k) || []), d]);
  }
  for (const [day, list] of byDay) {
    if (list.length < MIN_PEERS + 1) continue;
    const useGap = list.every(d => results.get(d.id)!.usualLossPct != null);
    const value = (d: DeliveryForCheck) => lossPct(d)! - (useGap ? results.get(d.id)!.usualLossPct! : 0);
    for (const d of list) {
      const others = list.filter(o => o.id !== d.id && !o.dismissed);
      if (others.length < MIN_PEERS) continue;
      const n = normalOf(others.map(value), MIN_SPREAD_PEER);
      const lv = level((value(d) - n.median) / n.spread);
      if (!lv) continue;
      const othersLoss = median(others.map(o => lossPct(o)!));
      results.get(d.id)!.flags.push({
        level: lv, check: 'peer',
        extraKg: r1(((value(d) - n.median) / 100) * d.teaSentKg),
        message: `Transport loss ${r1(lossPct(d)!)}% — other factories on ${day}: ${r1(othersLoss)}%`,
      });
    }
  }

  // 4. Trend: last 7 days vs the 30 days before, per factory + transport
  const trends: TrendFlag[] = [];
  const todayMs = new Date(dayKey(today)).getTime();
  const DAY = 86400000;
  const groups = new Map<string, DeliveryForCheck[]>();
  for (const d of carded.filter(x => !x.dismissed)) {
    const k = `${d.factoryId}|${d.transport}`;
    groups.set(k, [...(groups.get(k) || []), d]);
  }
  for (const list of groups.values()) {
    const age = (d: DeliveryForCheck) => (todayMs - new Date(dayKey(d.deliveryDate)).getTime()) / DAY;
    const recent = list.filter(d => age(d) < 7).map(d => lossPct(d)!);
    const prior = list.filter(d => age(d) >= 7 && age(d) < 37).map(d => lossPct(d)!);
    if (recent.length < 3 || prior.length < 10) continue;
    const n = normalOf(prior, MIN_SPREAD_LOSS);
    const recentAvg = recent.reduce((s, x) => s + x, 0) / recent.length;
    if ((recentAvg - n.median) / n.spread >= AMBER - 0.5) {
      trends.push({
        factoryId: list[0].factoryId,
        factoryName: list[0].factoryName,
        what: `Transport loss (${transportLabel(list[0].transport)})`,
        recentPct: r2(recentAvg),
        usualPct: r2(n.median),
      });
    }
  }

  // Deliveries without a card after 3 days
  const missingCards = all
    .filter(d => d.cardReceivedKg == null && (todayMs - new Date(dayKey(d.deliveryDate)).getTime()) / DAY > 3)
    .map(d => d.id);

  return { results, trends, missingCards };
}

// Clean a list of deduction names: trimmed, no blanks, no duplicates (case-insensitive)
export function cleanDeductionTypes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    const name = String(v ?? '').trim().slice(0, 40);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}
