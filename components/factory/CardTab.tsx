'use client';

import { useEffect, useState } from 'react';
import { Save, Clock, CheckCircle } from 'lucide-react';
import { call, fmtDay, jsonInit, kg, ShowToast, todayStr, transportText } from './shared';

interface Props {
  showToast: ShowToast;
  target: { date: string; factoryId: number; deliveryId: number } | null;
  onOpenCard: (d: any) => void;
}

export default function CardTab({ showToast, target, onOpenCard }: Props) {
  const [factories, setFactories] = useState<any[]>([]);
  const [date, setDate] = useState(target?.date ?? todayStr());
  const [factoryId, setFactoryId] = useState(target ? String(target.factoryId) : '');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(target?.deliveryId ?? null);
  const [received, setReceived] = useState('');
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const loadPending = async () => {
    const r = await call('/api/factory-deliveries?pendingCards=1');
    if (r.ok) setPending(r.data);
  };

  useEffect(() => {
    call('/api/factories?all=1').then(r => r.ok && setFactories(r.data));
    loadPending();
  }, []);

  // Jump here from a "waiting for card" link
  useEffect(() => {
    if (!target) return;
    setDate(target.date);
    setFactoryId(String(target.factoryId));
    setSelectedId(target.deliveryId);
  }, [target]);

  useEffect(() => {
    if (!date || !factoryId) { setDeliveries([]); return; }
    call(`/api/factory-deliveries?date=${date}&factoryId=${factoryId}`).then(r => {
      if (!r.ok) return;
      setDeliveries(r.data);
      // Auto-select when there is only one delivery (or keep the jumped-to one)
      setSelectedId(prev => (r.data.some((d: any) => d.id === prev) ? prev : r.data.length === 1 ? r.data[0].id : null));
    });
  }, [date, factoryId]);

  const selected = deliveries.find(d => d.id === selectedId) ?? null;

  // Fill the form with the saved card (if any) when a delivery is selected
  useEffect(() => {
    if (!selected) { setReceived(''); setDeductions({}); return; }
    setReceived(selected.cardReceivedKg != null ? String(selected.cardReceivedKg) : '');
    const saved = (selected.cardDeductions ?? {}) as Record<string, number>;
    const names = [...(selected.factory.deductionTypes as string[]), ...Object.keys(saved)];
    const next: Record<string, string> = {};
    for (const n of names) next[n] = saved[n] != null ? String(saved[n]) : '';
    setDeductions(next);
  }, [selectedId, deliveries]);

  const rec = parseFloat(received) || 0;
  const totalDed = Object.values(deductions).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const loss = selected && rec > 0 ? selected.teaSentKg - rec : null;
  const lossPct = selected && loss != null && selected.teaSentKg > 0 ? (loss / selected.teaSentKg) * 100 : null;

  const save = async () => {
    if (!selected) return;
    if (rec <= 0) { showToast('Please enter the weight received at the factory', 'warning'); return; }
    setSaving(true);
    const r = await call(`/api/factory-deliveries/${selected.id}/card`, jsonInit('PUT', { receivedKg: rec, deductions }));
    setSaving(false);
    if (!r.ok) { showToast(r.error!, 'error'); return; }
    showToast('Factory card saved / සුරකින ලදී');
    setDeliveries(ds => ds.map(d => (d.id === r.data.id ? r.data : d)));
    loadPending();
  };

  const row = (label: string, value: string, color?: string, bold?: boolean) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color, fontWeight: bold ? 700 : 400, padding: '3px 0' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-body">
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Delivery date / දිනය</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Factory / කර්මාන්තශාලාව</label>
              <select className="form-select" value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
                <option value="">— Choose —</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {date && factoryId && deliveries.length === 0 && (
        <p style={{ color: 'var(--gray-500)', marginBottom: '16px' }}>No delivery to this factory on {fmtDay(date + 'T00:00:00Z')}.</p>
      )}

      {deliveries.length > 1 && (
        <div style={{ marginBottom: '16px' }}>
          <p className="form-label">This factory got {deliveries.length} deliveries that day — choose one:</p>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {deliveries.map((d, i) => (
              <button key={d.id} onClick={() => setSelectedId(d.id)} className="card"
                style={{ textAlign: 'left', cursor: 'pointer', padding: '12px', border: d.id === selectedId ? '2px solid var(--primary-600)' : undefined }}>
                <strong>Delivery {i + 1}: {kg(d.teaSentKg)}</strong>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{transportText(d)}</div>
                <div style={{ marginTop: '4px' }}>
                  {d.cardReceivedKg != null ? <span className="badge badge-green"><CheckCircle size={11} /> Card in</span> : <span className="badge badge-amber">Waiting</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-body">
            <div style={{ background: 'var(--gray-50)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
              <strong>{selected.factory.name}</strong> · {fmtDay(selected.deliveryDate)} · {transportText(selected)}
              {row('Tea sent / යැවූ තේ', kg(selected.teaSentKg), undefined, true)}
              {selected.gunnyBags && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>({kg(selected.handedOverKg)} handed over − {kg(selected.gunnyBagKg)} gunny bags)</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Weight received at factory (kg) / කර්මාන්තශාලාවට ලැබුණු බර *</label>
              <input type="number" step="0.01" min="0" inputMode="decimal" className="form-input" value={received}
                onChange={(e) => setReceived(e.target.value)} placeholder="From the factory card" />
            </div>

            {Object.keys(deductions).length === 0 ? (
              <p className="form-help" style={{ marginBottom: '12px' }}>This factory has no deductions set (add them in the Factories tab).</p>
            ) : (
              <div className="form-row">
                {Object.keys(deductions).map(name => (
                  <div className="form-group" key={name}>
                    <label className="form-label">{name} (kg)</label>
                    <input type="number" step="0.01" min="0" inputMode="decimal" className="form-input" value={deductions[name]}
                      onChange={(e) => setDeductions({ ...deductions, [name]: e.target.value })} placeholder="0" />
                  </div>
                ))}
              </div>
            )}

            {rec > 0 && (
              <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
                {row('Tea sent', kg(selected.teaSentKg))}
                {row('Received at factory', kg(rec))}
                {row(`Transport loss`, `${kg(Math.round(loss! * 100) / 100)} (${lossPct!.toFixed(1)}%)`, loss! > 0 ? '#b45309' : undefined)}
                {Object.entries(deductions).filter(([, v]) => parseFloat(v) > 0).map(([n, v]) => row(`− ${n}`, `− ${kg(parseFloat(v))}`, '#dc2626'))}
                <div style={{ borderTop: '1px solid var(--primary-100)', marginTop: '6px', paddingTop: '6px' }}>
                  {row('Final accepted / අවසාන බර', kg(Math.round((rec - totalDed) * 100) / 100), undefined, true)}
                </div>
              </div>
            )}

            <button className="btn btn-primary btn-lg" onClick={save} disabled={saving} style={{ width: '100%' }}>
              <Save size={18} /> {saving ? 'Saving…' : selected.cardReceivedKg != null ? 'Update card' : 'Save card / සුරකින්න'}
            </button>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Clock size={16} /> Waiting for factory card ({pending.length})
      </h3>
      {pending.length === 0 ? (
        <p style={{ color: 'var(--gray-500)' }}>All cards are in. 👍</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Date</th><th>Factory</th><th>Tea sent</th><th>Transport</th><th></th></tr></thead>
            <tbody>
              {pending.map(d => (
                <tr key={d.id}>
                  <td>{fmtDay(d.deliveryDate)}</td>
                  <td style={{ fontWeight: 600 }}>{d.factory.name}</td>
                  <td>{kg(d.teaSentKg)}</td>
                  <td style={{ fontSize: '13px' }}>{transportText(d)}</td>
                  <td><button className="btn btn-sm btn-primary" onClick={() => onOpenCard(d)}>Enter card</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
