// Small helpers shared by the Factory Deliveries tabs

export type ShowToast = (message: string, type?: 'success' | 'error' | 'warning') => void;

// Today's date as YYYY-MM-DD in the user's local time (Sri Lanka)
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Delivery dates are stored as UTC midnight, so show them in UTC: "4 Oct 2026"
export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const kg = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;

export const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`);

// Read a JSON response; returns { ok, data, error }
export async function call(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data, error: res.ok ? null : (data.error || 'Something went wrong') };
  } catch {
    return { ok: false, data: null, error: 'Network error. Please try again.' };
  }
}

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function transportText(d: any) {
  if (d.transport === 'factory') return `Factory lorry${d.factoryVehicleNo ? ` · ${d.factoryVehicleNo}` : ''}`;
  return `Our lorry · ${d.lorry?.lorryNumber ?? '?'} · ${d.driver?.name ?? '?'}`;
}
