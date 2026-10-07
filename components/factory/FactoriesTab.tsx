'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, X, Pencil, Save, Factory as FactoryIcon } from 'lucide-react';
import Modal from '@/components/Modal';
import { call, jsonInit, ShowToast } from './shared';

// Common deductions on factory cards — one tap to add
const SUGGESTIONS = ['Water / වතුර', 'Crates / කූඩ', 'Mature leaves / මෝරපු දලු', 'Bags / මලු'];

export default function FactoriesTab({ showToast }: { showToast: ShowToast }) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null); // null = closed, {} = new
  const [name, setName] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const [saving, setSaving] = useState(false);
  const [rate, setRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  const load = async () => {
    setLoading(true);
    const [f, s] = await Promise.all([call('/api/factories?all=1'), call('/api/settings')]);
    if (f.ok) setFactories(f.data);
    if (s.ok) setRate(s.data.delivery_commission_per_kg ?? '1');
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const open = (f: any | null) => {
    setEditing(f ?? {});
    setName(f?.name ?? '');
    setTypes(f?.deductionTypes ?? []);
    setNewType('');
  };

  const addType = (t: string) => {
    const v = t.trim();
    if (!v || types.some(x => x.toLowerCase() === v.toLowerCase())) return;
    setTypes([...types, v]);
    setNewType('');
  };

  const save = async () => {
    if (!name.trim()) { showToast('Please enter the factory name', 'warning'); return; }
    setSaving(true);
    const body = { name, deductionTypes: types };
    const r = editing?.id
      ? await call(`/api/factories/${editing.id}`, jsonInit('PUT', body))
      : await call('/api/factories', jsonInit('POST', body));
    setSaving(false);
    if (!r.ok) { showToast(r.error!, 'error'); return; }
    showToast('Factory saved / සුරකින ලදී');
    setEditing(null);
    load();
  };

  const toggleActive = async (f: any) => {
    const r = await call(`/api/factories/${f.id}`, jsonInit('PUT', { active: !f.active }));
    if (!r.ok) showToast(r.error!, 'error');
    load();
  };

  const saveRate = async () => {
    setSavingRate(true);
    const r = await call('/api/settings', jsonInit('PUT', { delivery_commission_per_kg: rate }));
    setSavingRate(false);
    showToast(r.ok ? 'Delivery commission rate saved' : r.error!, r.ok ? 'success' : 'error');
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Delivery commission (our lorry) — Rs. per kg</label>
              <input type="number" step="0.01" min="0" className="form-input" value={rate}
                onChange={(e) => setRate(e.target.value)} disabled={!isAdmin} />
            </div>
            {isAdmin && (
              <button className="btn btn-primary" onClick={saveRate} disabled={savingRate}>
                <Save size={16} /> Save rate
              </button>
            )}
          </div>
          <p className="form-help" style={{ marginTop: '8px' }}>
            Paid to our driver for each kg of tea taken to a factory. A new rate applies to deliveries recorded after you save it.
            {!isAdmin && ' Only admin can change it.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Factories</h3>
        <button className="btn btn-primary" onClick={() => open(null)}><Plus size={16} /> Add factory</button>
      </div>

      {factories.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
          <FactoryIcon size={36} style={{ marginBottom: '8px' }} />
          <p>No factories yet. Add the factories you send tea to.</p>
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {factories.map(f => (
            <div key={f.id} className="card" style={{ opacity: f.active ? 1 : 0.55 }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <strong style={{ fontSize: '16px' }}>{f.name}</strong>
                  {!f.active && <span className="badge badge-gray">Inactive</span>}
                </div>
                <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(f.deductionTypes as string[]).length === 0
                    ? <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No deductions set</span>
                    : (f.deductionTypes as string[]).map(t => <span key={t} className="badge badge-blue">{t}</span>)}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => open(f)}><Pencil size={14} /> Edit</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => toggleActive(f)}>{f.active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit factory' : 'Add factory'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> Save</button>
        </>}>
        <div className="form-group">
          <label className="form-label">Factory name *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Factory A" />
        </div>
        <div className="form-group">
          <label className="form-label">Deductions on their card</label>
          <p className="form-help" style={{ marginBottom: '8px' }}>Add the deduction names exactly as this factory writes them on its card.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {types.length === 0 && <span style={{ color: 'var(--gray-400)', fontSize: '13px' }}>None yet</span>}
            {types.map(t => (
              <span key={t} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {t}
                <button onClick={() => setTypes(types.filter(x => x !== t))} aria-label={`Remove ${t}`}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="form-input" value={newType} onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addType(newType); } }}
              placeholder="Type a deduction name and press Add" />
            <button className="btn btn-secondary" onClick={() => addType(newType)}><Plus size={16} /> Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {SUGGESTIONS.filter(s => !types.includes(s)).map(s => (
              <button key={s} className="btn btn-sm btn-ghost" onClick={() => addType(s)}><Plus size={12} /> {s}</button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
