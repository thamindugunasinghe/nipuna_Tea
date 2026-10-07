'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertTriangle, TrendingUp, Clock, CheckCircle, Undo2, Truck, Scale, Flag } from 'lucide-react';
import Modal from '@/components/Modal';
import { call, fmtDay, jsonInit, kg, pct, ShowToast, transportText } from './shared';

const REASONS: Record<string, string> = {
  rain: '🌧 Rain / වැස්ස',
  breakdown: '🔧 Lorry breakdown / ලොරිය කැඩීම',
  delay: '⏱ Delay / ප්‍රමාදය',
  other: '✏️ Other / වෙනත්',
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardTab({ showToast, onOpenCard }: { showToast: ShowToast; onOpenCard: (d: any) => void }) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<any | null>(null);
  const [reason, setReason] = useState('rain');
  const [note, setNote] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);

  const load = async () => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return;
    setLoading(true);
    const r = await call(`/api/factory-deliveries/dashboard?month=${m}&year=${y}`);
    if (r.ok) setData(r.data); else showToast(r.error!, 'error');
    setLoading(false);
  };
  useEffect(() => { load(); }, [month]);

  const dismiss = async () => {
    const r = await call(`/api/factory-deliveries/${dismissing.id}/dismiss`, jsonInit('POST', { reason, note }));
    if (!r.ok) { showToast(r.error!, 'error'); return; }
    showToast('Marked as explained');
    setDismissing(null);
    load();
  };

  const undo = async (d: any) => {
    const r = await call(`/api/factory-deliveries/${d.id}/dismiss`, { method: 'DELETE' });
    if (!r.ok) { showToast(r.error!, 'error'); return; }
    load();
  };

  const flagged = (data?.deliveries ?? []).filter((d: any) => d.check?.flags.length && !d.flagDismissedReason);
  const dismissed = (data?.deliveries ?? []).filter((d: any) => d.check?.flags.length && d.flagDismissedReason);

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Month / මාසය</label>
          <input type="month" className="form-input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
      </div>

      {loading || !data ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <>
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-icon green"><Truck size={24} /></div>
              <div className="stat-content"><h3>Deliveries</h3><div className="stat-value">{data.totals.deliveries}</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><Scale size={24} /></div>
              <div className="stat-content"><h3>Tea sent</h3><div className="stat-value">{data.totals.sentKg.toLocaleString()}</div><div className="stat-sub">kg</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon amber"><Flag size={24} /></div>
              <div className="stat-content"><h3>Flags</h3><div className="stat-value">{data.totals.flagged}</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple"><Clock size={24} /></div>
              <div className="stat-content"><h3>Waiting for card</h3><div className="stat-value">{data.totals.waitingCards}</div></div>
            </div>
          </div>

          {/* Flags */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={18} color="#dc2626" /> Flags
          </h3>
          {flagged.length === 0 ? (
            <div className="card" style={{ marginBottom: '20px' }}><div className="card-body" style={{ color: 'var(--gray-500)' }}>
              <CheckCircle size={16} color="#16a34a" style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Nothing unusual found this month.
            </div></div>
          ) : (
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {flagged.map((d: any) => {
                const red = d.check.flags.some((f: any) => f.level === 'red');
                return (
                  <div key={d.id} className="card" style={{ borderLeft: `4px solid ${red ? '#dc2626' : '#f59e0b'}` }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div>
                          <strong>{red ? '🔴' : '🟡'} {d.factory.name} · {fmtDay(d.deliveryDate)}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{transportText(d)} · sent {kg(d.teaSentKg)} · received {kg(d.cardReceivedKg)}</div>
                        </div>
                        {isAdmin && (
                          <button className="btn btn-sm btn-secondary" onClick={() => { setDismissing(d); setReason('rain'); setNote(''); }}>
                            <CheckCircle size={14} /> Mark as explained
                          </button>
                        )}
                      </div>
                      <ul style={{ margin: '8px 0 0 18px', fontSize: '14px' }}>
                        {d.check.flags.map((f: any, i: number) => (
                          <li key={i}>{f.message}{f.extraKg > 0 ? ` — about ${kg(f.extraKg)} more than normal` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {dismissed.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowDismissed(!showDismissed)}>
                {showDismissed ? 'Hide' : 'Show'} explained flags ({dismissed.length})
              </button>
              {showDismissed && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                  {dismissed.map((d: any) => (
                    <div key={d.id} className="card" style={{ opacity: 0.7 }}>
                      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div>
                          <strong>{d.factory.name} · {fmtDay(d.deliveryDate)}</strong> — {REASONS[d.flagDismissedReason]}{d.flagDismissedNote ? `: ${d.flagDismissedNote}` : ''}
                          <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                            by {d.flagDismissedBy} · {d.check.flags.map((f: any) => f.message).join(' · ')}
                          </div>
                        </div>
                        {isAdmin && <button className="btn btn-sm btn-ghost" onClick={() => undo(d)}><Undo2 size={14} /> Undo</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trends */}
          {data.trends.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #f59e0b' }}>
              <div className="card-body">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} /> Rising trend (last 7 days vs the 30 days before)</strong>
                <ul style={{ margin: '8px 0 0 18px', fontSize: '14px' }}>
                  {data.trends.map((t: any, i: number) => (
                    <li key={i}>📈 <strong>{t.factoryName}</strong>: {t.what} {pct(t.recentPct)} lately — usual {pct(t.usualPct)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Overdue cards */}
          {data.overdueCards.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #8b5cf6' }}>
              <div className="card-body">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> No factory card after 3 days</strong>
                <div style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
                  {data.overdueCards.map((d: any) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span>{fmtDay(d.deliveryDate)} · <strong>{d.factory.name}</strong> · {kg(d.teaSentKg)}</span>
                      <button className="btn btn-sm btn-primary" onClick={() => onOpenCard(d)}>Enter card</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Per factory */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>By factory</h3>
          {data.factories.length === 0 ? (
            <p style={{ color: 'var(--gray-500)', marginBottom: '20px' }}>No deliveries this month.</p>
          ) : (
            <div className="table-wrapper" style={{ marginBottom: '20px' }}>
              <table className="table">
                <thead>
                  <tr><th>Factory</th><th>Deliveries</th><th>Tea sent</th><th>Received</th><th>Transport loss</th><th>Deductions</th><th>Accepted</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.factories.map((f: any) => (
                    <tr key={f.factoryId}>
                      <td style={{ fontWeight: 600 }}>{f.factoryName}</td>
                      <td>{f.deliveries}{f.cardsIn < f.deliveries ? <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}> ({f.deliveries - f.cardsIn} no card)</span> : ''}</td>
                      <td>{kg(f.sentKg)}</td>
                      <td>{f.cardsIn ? kg(f.receivedKg) : '—'}</td>
                      <td>{f.cardsIn ? `${kg(f.transportLossKg)} (${pct(f.transportLossPct)})` : '—'}</td>
                      <td>{f.cardsIn ? `${kg(f.deductionKg)} (${pct(f.deductionPct)})` : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{f.cardsIn ? kg(f.acceptedKg) : '—'}</td>
                      <td style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {f.flagged > 0 && <span className="badge badge-red">{f.flagged} flag{f.flagged > 1 ? 's' : ''}</span>}
                        {f.trend && <span className="badge badge-amber">📈 Rising</span>}
                        {f.learning && <span className="badge badge-blue" title="Needs about 15 delivery cards to learn this factory's normal">🔵 Learning</span>}
                        {!f.flagged && !f.trend && !f.learning && <span className="badge badge-green">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All deliveries */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>All deliveries</h3>
          {data.deliveries.length === 0 ? <p style={{ color: 'var(--gray-500)' }}>No deliveries this month.</p> : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Factory</th><th>Transport</th><th>Tea sent</th><th>Received</th><th>Loss</th><th>Deductions</th><th>Accepted</th><th></th></tr>
                </thead>
                <tbody>
                  {data.deliveries.map((d: any) => {
                    const c = d.check;
                    const red = c?.flags.some((f: any) => f.level === 'red');
                    return (
                      <tr key={d.id}>
                        <td>{fmtDay(d.deliveryDate)}</td>
                        <td style={{ fontWeight: 600 }}>{d.factory.name}</td>
                        <td style={{ fontSize: '13px' }}>{transportText(d)}</td>
                        <td>{kg(d.teaSentKg)}</td>
                        <td>{kg(d.cardReceivedKg)}</td>
                        <td>{c ? `${kg(c.transportLossKg)} (${pct(c.transportLossPct)})` : '—'}{c?.usualLossPct != null && <div style={{ fontSize: '11px', color: 'var(--gray-400)' }}>usual {pct(c.usualLossPct)}</div>}</td>
                        <td>{c ? `${kg(c.deductionKg)} (${pct(c.deductionPct)})` : '—'}</td>
                        <td>{kg(d.cardAcceptedKg)}</td>
                        <td>
                          {d.cardReceivedKg == null ? (
                            <button className="btn btn-sm btn-secondary" onClick={() => onOpenCard(d)}>Enter card</button>
                          ) : c?.flags.length ? (
                            d.flagDismissedReason ? <span className="badge badge-gray">Explained</span>
                              : <span className={`badge ${red ? 'badge-red' : 'badge-amber'}`}>{red ? '🔴 Check' : '🟡 Check'}</span>
                          ) : c?.learning ? <span className="badge badge-blue">Learning</span> : <span className="badge badge-green">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal isOpen={!!dismissing} onClose={() => setDismissing(null)} title="Mark flag as explained"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setDismissing(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={dismiss}><CheckCircle size={16} /> Save</button>
        </>}>
        {dismissing && (
          <>
            <p style={{ marginBottom: '12px' }}>
              <strong>{dismissing.factory.name}</strong> · {fmtDay(dismissing.deliveryDate)}. This delivery won&apos;t be used when learning what is normal.
            </p>
            <div className="form-group">
              <label className="form-label">Reason / හේතුව</label>
              <div style={{ display: 'grid', gap: '6px' }}>
                {Object.entries(REASONS).map(([k, label]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} /> {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Note {reason === 'other' ? '*' : '(optional)'}</label>
              <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
