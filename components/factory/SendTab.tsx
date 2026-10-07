'use client';

import { useEffect, useState } from 'react';
import { Truck, Building2, Save, Pencil, Trash2, X } from 'lucide-react';
import { call, fmtDay, jsonInit, kg, ShowToast, todayStr, transportText } from './shared';

const emptyForm = () => ({
  deliveryDate: todayStr(),
  factoryId: '',
  transport: 'ours' as 'ours' | 'factory',
  lorryId: '',
  driverId: '',
  factoryVehicleNo: '',
  handedOverKg: '',
  gunnyBags: false,
  gunnyBagKg: '',
  note: '',
});

export default function SendTab({ showToast, onGoToFactories }: { showToast: ShowToast; onGoToFactories: () => void }) {
  const [factories, setFactories] = useState<any[]>([]);
  const [lorries, setLorries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [rate, setRate] = useState<number>(1);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [list, setList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [f, l, d, s] = await Promise.all([
        call('/api/factories'), call('/api/fleet/lorries'), call('/api/fleet/drivers'), call('/api/settings'),
      ]);
      if (f.ok) setFactories(f.data);
      if (l.ok) setLorries(l.data);
      if (d.ok) setDrivers(d.data.filter((x: any) => x.active !== false));
      if (s.ok) setRate(parseFloat(s.data.delivery_commission_per_kg ?? '1') || 0);
      setLoading(false);
    })();
  }, []);

  const loadList = async (date: string) => {
    const r = await call(`/api/factory-deliveries?date=${date}`);
    if (r.ok) setList(r.data);
  };
  useEffect(() => { if (form.deliveryDate) loadList(form.deliveryDate); }, [form.deliveryDate]);

  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm(f => ({ ...f, ...patch }));

  const handed = parseFloat(form.handedOverKg) || 0;
  const gunny = form.gunnyBags ? parseFloat(form.gunnyBagKg) || 0 : 0;
  const teaSent = Math.round((handed - gunny) * 100) / 100;

  const save = async () => {
    if (!form.factoryId) { showToast('Please choose a factory', 'warning'); return; }
    if (form.transport === 'ours' && (!form.lorryId || !form.driverId)) { showToast('Please choose the lorry and driver', 'warning'); return; }
    if (handed <= 0) { showToast('Please enter the weight handed over', 'warning'); return; }
    if (form.gunnyBags && (gunny <= 0 || gunny >= handed)) { showToast('Please enter the total gunny bag weight', 'warning'); return; }

    setSaving(true);
    const body = { ...form, handedOverKg: handed, gunnyBagKg: gunny };
    const r = editingId
      ? await call(`/api/factory-deliveries/${editingId}`, jsonInit('PUT', body))
      : await call('/api/factory-deliveries', jsonInit('POST', body));
    setSaving(false);
    if (!r.ok) { showToast(r.error!, 'error'); return; }

    showToast(editingId ? 'Delivery updated / යාවත්කාලීන කළා' : 'Delivery saved / සුරකින ලදී');
    // Keep date/factory/transport for the next entry; clear the weights
    setForm(f => ({ ...f, handedOverKg: '', gunnyBagKg: '', note: '' }));
    setEditingId(null);
    loadList(form.deliveryDate);
  };

  const edit = (d: any) => {
    setEditingId(d.id);
    setForm({
      deliveryDate: d.deliveryDate.slice(0, 10),
      factoryId: String(d.factoryId),
      transport: d.transport,
      lorryId: d.lorryId ? String(d.lorryId) : '',
      driverId: d.driverId ? String(d.driverId) : '',
      factoryVehicleNo: d.factoryVehicleNo ?? '',
      handedOverKg: String(d.handedOverKg),
      gunnyBags: d.gunnyBags,
      gunnyBagKg: d.gunnyBags ? String(d.gunnyBagKg) : '',
      note: d.note ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (d: any) => {
    if (!confirm(`Delete this delivery to ${d.factory.name} (${kg(d.teaSentKg)})?`)) return;
    const r = await call(`/api/factory-deliveries/${d.id}`, { method: 'DELETE' });
    showToast(r.ok ? 'Delivery deleted' : r.error!, r.ok ? 'success' : 'error');
    loadList(form.deliveryDate);
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  if (factories.length === 0) {
    return (
      <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ marginBottom: '12px' }}>Add your factories first.</p>
        <button className="btn btn-primary" onClick={onGoToFactories}>Go to Factories</button>
      </div></div>
    );
  }

  const segBtn = (active: boolean) => `btn ${active ? 'btn-primary' : 'btn-secondary'}`;

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          {editingId && (
            <div style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Editing a delivery</span>
              <button className="btn btn-sm btn-ghost" onClick={() => { setEditingId(null); setForm(f => ({ ...emptyForm(), deliveryDate: f.deliveryDate })); }}>
                <X size={14} /> Cancel edit
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date / දිනය *</label>
              <input type="date" className="form-input" value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Factory / කර්මාන්තශාලාව *</label>
              <select className="form-select" value={form.factoryId} onChange={(e) => set({ factoryId: e.target.value })}>
                <option value="">— Choose —</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Transport / ප්‍රවාහනය *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className={segBtn(form.transport === 'ours')} onClick={() => set({ transport: 'ours' })}>
                <Truck size={16} /> Our lorry / අපේ ලොරිය
              </button>
              <button className={segBtn(form.transport === 'factory')} onClick={() => set({ transport: 'factory' })}>
                <Building2 size={16} /> Factory lorry / ඔවුන්ගේ ලොරිය
              </button>
            </div>
          </div>

          {form.transport === 'ours' ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Lorry / ලොරිය *</label>
                  <select className="form-select" value={form.lorryId} onChange={(e) => set({ lorryId: e.target.value })}>
                    <option value="">— Choose —</option>
                    {lorries.map(l => <option key={l.id} value={l.id}>{l.lorryNumber}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Driver / රියදුරු *</label>
                  <select className="form-select" value={form.driverId} onChange={(e) => set({ driverId: e.target.value })}>
                    <option value="">— Choose —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="form-help" style={{ marginTop: '-8px', marginBottom: '12px' }}>
                Driver earns Rs. {rate}/kg delivery commission{teaSent > 0 ? ` = Rs. ${(Math.round(teaSent * rate * 100) / 100).toLocaleString()}` : ''} (paid from Driver Commissions → Factory Delivery).
              </p>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Factory vehicle number (optional)</label>
              <input className="form-input" value={form.factoryVehicleNo} onChange={(e) => set({ factoryVehicleNo: e.target.value })} placeholder="e.g. LB-1234" />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Weight handed over (kg) / බාර දුන් බර *</label>
              <input type="number" step="0.01" min="0" inputMode="decimal" className="form-input" value={form.handedOverKg}
                onChange={(e) => set({ handedOverKg: e.target.value })} placeholder="e.g. 1000" />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.gunnyBags} onChange={(e) => set({ gunnyBags: e.target.checked, gunnyBagKg: '' })}
                  style={{ width: '18px', height: '18px' }} />
                Factory gunny bags included / කර්මාන්තශාලා ගෝනි
              </label>
              {form.gunnyBags && (
                <input type="number" step="0.01" min="0" inputMode="decimal" className="form-input" value={form.gunnyBagKg}
                  onChange={(e) => set({ gunnyBagKg: e.target.value })} placeholder="Total gunny bag weight (kg)" />
              )}
            </div>
          </div>

          {handed > 0 && (
            <div style={{ background: 'var(--primary-50)', border: '1px solid var(--primary-100)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Weight handed over</span><span>{kg(handed)}</span></div>
              {form.gunnyBags && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>− Gunny bags</span><span>− {kg(gunny)}</span></div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--primary-100)', marginTop: '6px', paddingTop: '6px' }}>
                <span>Tea weight sent / යැවූ තේ බර</span><span>{kg(teaSent > 0 ? teaSent : 0)}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Note (optional)</label>
            <input className="form-input" value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </div>

          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving} style={{ width: '100%' }}>
            <Save size={18} /> {saving ? 'Saving…' : editingId ? 'Update delivery' : 'Save delivery / සුරකින්න'}
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>Deliveries on {fmtDay(form.deliveryDate + 'T00:00:00Z')}</h3>
      {list.length === 0 ? (
        <p style={{ color: 'var(--gray-500)' }}>No deliveries recorded for this day.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Factory</th><th>Transport</th><th>Handed over</th><th>Gunny</th><th>Tea sent</th><th>Card</th><th></th></tr></thead>
            <tbody>
              {list.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.factory.name}</td>
                  <td style={{ fontSize: '13px' }}>{transportText(d)}</td>
                  <td>{kg(d.handedOverKg)}</td>
                  <td>{d.gunnyBags ? `− ${kg(d.gunnyBagKg)}` : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{kg(d.teaSentKg)}</td>
                  <td>{d.cardReceivedKg != null ? <span className="badge badge-green">Card in</span> : <span className="badge badge-amber">Waiting</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!d.driverCommission?.paid && (
                      <button className="btn btn-sm btn-ghost" onClick={() => edit(d)} title="Edit"><Pencil size={14} /></button>
                    )}
                    {d.cardReceivedKg == null && !d.driverCommission?.paid && (
                      <button className="btn btn-sm btn-ghost" onClick={() => remove(d)} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
