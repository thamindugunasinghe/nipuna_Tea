'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Scale, Droplets, CheckCircle, Search, AlertTriangle, Loader2 } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';

const waterLabels = ['Dry / වියළි', 'Slight / සුළු', 'Moderate / මධ්‍යම', 'Very Wet / ඉතා තෙත්'];
const waterColors = ['badge-green', 'badge-blue', 'badge-amber', 'badge-red'];
const dropIcons = ['🍂', '💧', '💧💧', '💧💧💧'];

export default function ValidationPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [lorries, setLorries] = useState<any[]>([]);
  const [lorryId, setLorryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [warehouseKilos, setWarehouseKilos] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch('/api/fleet/lorries').then(r => r.json()).then(setLorries).catch(console.error);
  }, []);

  const handleLoad = async () => {
    if (!lorryId || !date) {
      showToast('Please select lorry and date / කරුණාකර ලොරිය හා දිනය තෝරන්න', 'warning');
      return;
    }
    setLoading(true);
    setResult(null);
    setWarehouseKilos('');
    try {
      const url = lorryId === 'warehouse'
          ? `/api/validation?warehouse=true&date=${date}`
          : `/api/validation?lorryId=${lorryId}&date=${date}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.existingValidation) {
          setWarehouseKilos(String(d.existingValidation.totalWarehouseKilos));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleValidate = async () => {
    if (!warehouseKilos || parseFloat(warehouseKilos) <= 0) {
      showToast('Enter the warehouse weight / ගබඩා බර ඇතුළත් කරන්න', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lorryId: lorryId === 'warehouse' ? null : parseInt(lorryId),
          warehouse: lorryId === 'warehouse',
          date,
          warehouseKilos: parseFloat(warehouseKilos),
        }),
      });
      if (res.ok) {
        const r = await res.json();
        setResult(r);
        showToast('Validation completed! / තහවුරු කිරීම සම්පූර්ණයි!', 'success');
        // Refresh data
        handleLoad();
      } else {
        const err = await res.json();
        showToast(err.error || t('common.error'), 'error');
      }
    } catch (e) {
      showToast(t('common.error'), 'error');
    }
    setSubmitting(false);
  };

  // Preview calculations
  const previewDeductions = () => {
    if (!data?.collections || !warehouseKilos) return null;
    const wh = parseFloat(warehouseKilos);
    if (wh <= 0 || isNaN(wh)) return null;

    const totalDriverKilos = data.totalDriverKilos;
    const totalLoss = Math.max(0, totalDriverKilos - wh);

    const weightedScores = data.collections.map((c: any) => ({
      id: c.id,
      name: c.customer?.name,
      kilos: c.kilosByDriver,
      waterScore: c.waterScore || 0,
      weightedScore: c.kilosByDriver * (c.waterScore || 0),
    }));

    const totalWeightedScore = weightedScores.reduce((sum: number, w: any) => sum + w.weightedScore, 0);

    return weightedScores.map((w: any) => {
      let deduction: number;
      if (totalLoss === 0) {
        deduction = 0;
      } else if (totalWeightedScore > 0) {
        deduction = (w.weightedScore / totalWeightedScore) * totalLoss;
      } else {
        deduction = (w.kilos / totalDriverKilos) * totalLoss;
      }
      return {
        ...w,
        deduction: Math.round(deduction * 100) / 100,
        validatedKilos: Math.round((w.kilos - deduction) * 100) / 100,
      };
    });
  };

  const preview = previewDeductions();
  const totalLoss = data ? Math.max(0, data.totalDriverKilos - parseFloat(warehouseKilos || '0')) : 0;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1><Scale size={28} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Validation / තහවුරු කිරීම</h1>
      </div>

      {/* Lorry + Date Selector */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Lorry / ලොරිය තෝරන්න</label>
              <select className="form-select" value={lorryId} onChange={(e) => setLorryId(e.target.value)}>
                <option value="">Select Lorry...</option>
                <option value="warehouse">🏭 Warehouse / ගබඩාව</option>
                {lorries.map(l => <option key={l.id} value={l.id}>{l.lorryNumber}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date / දිනය</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleLoad} disabled={loading}>
              <Search size={18} /> {loading ? 'Loading...' : 'Load Collections'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && <div className="loading-overlay"><div className="spinner" /></div>}

      {data && !loading && (
        <>
          {data.collections.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '60px' }}>
                <Scale size={48} color="var(--gray-300)" />
                <h3 style={{ color: 'var(--gray-500)', marginTop: '12px' }}>No Collections Found</h3>
                <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>No tea collections recorded for this lorry on this date.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Already validated warning */}
              {data.allValidated && data.existingValidation && (
                <div style={{
                  background: 'var(--primary-50)', border: '1px solid var(--primary-200)',
                  borderRadius: '10px', padding: '14px 18px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--primary-800)',
                }}>
                  <CheckCircle size={20} />
                  <div>
                    <strong>Already validated!</strong> Warehouse: {data.existingValidation.totalWarehouseKilos} kg,
                    Loss: {data.existingValidation.weightLoss} kg.
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)', marginLeft: '6px' }}>
                      Re-submitting will update the existing validation.
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="stats-grid" style={{ marginBottom: '20px' }}>
                <div className="stat-card">
                  <div className="stat-icon green"><Scale size={24} /></div>
                  <div className="stat-content">
                    <h3>Driver Total / රියදුරු එකතුව</h3>
                    <div className="stat-value">{data.totalDriverKilos.toLocaleString()}</div>
                    <div className="stat-sub">kg — {data.collectionsCount} collections</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue"><Scale size={24} /></div>
                  <div className="stat-content">
                    <h3>Warehouse Weight / ගබඩා බර</h3>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={warehouseKilos}
                      onChange={(e) => setWarehouseKilos(e.target.value)}
                      placeholder="Enter weight..."
                      style={{ maxWidth: '180px', fontSize: '20px', fontWeight: 700, marginTop: '4px' }}
                    />
                  </div>
                </div>
                {warehouseKilos && (
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: totalLoss > 0 ? '#fee2e2' : 'var(--primary-100)', color: totalLoss > 0 ? '#dc2626' : 'var(--primary-700)' }}>
                      <Droplets size={24} />
                    </div>
                    <div className="stat-content">
                      <h3>Weight Loss / බර අඩුවීම</h3>
                      <div className="stat-value" style={{ color: totalLoss > 0 ? '#dc2626' : 'var(--primary-700)' }}>
                        {totalLoss.toLocaleString()} kg
                      </div>
                      <div className="stat-sub">
                        {data.totalDriverKilos > 0 ? ((totalLoss / data.totalDriverKilos) * 100).toFixed(1) : 0}% loss
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collections Table with Preview */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header">
                  <h2>Collections / එකතු කිරීම්</h2>
                </div>
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Driver</th>
                        <th>Driver Kilos</th>
                        <th>Water Score</th>
                        {preview && <th style={{ color: '#dc2626' }}>Deduction</th>}
                        <th>Validated Kilos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.collections.map((c: any, i: number) => {
                        const p = preview?.find((x: any) => x.id === c.id);
                        return (
                          <tr key={c.id}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{c.customer?.name}</td>
                            <td>{c.driver?.name || '-'}</td>
                            <td>{c.kilosByDriver} kg</td>
                            <td>
                              <span className={`badge ${waterColors[c.waterScore || 0]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {dropIcons[c.waterScore || 0]} {c.waterScore || 0}
                              </span>
                            </td>
                            {preview && (
                              <td style={{ color: '#dc2626', fontWeight: 600 }}>
                                {p && p.deduction > 0 ? `- ${p.deduction} kg` : '—'}
                              </td>
                            )}
                            <td>
                              {c.kilosValidated != null ? (
                                <span className="badge badge-green">
                                  <CheckCircle size={12} style={{ marginRight: 4 }} />
                                  {c.kilosValidated} kg
                                </span>
                              ) : p ? (
                                <span style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                                  {p.validatedKilos} kg
                                </span>
                              ) : (
                                <span className="badge badge-amber">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {preview && (
                      <tfoot>
                        <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                          <td colSpan={3}>Total</td>
                          <td>{data.totalDriverKilos} kg</td>
                          <td></td>
                          <td style={{ color: '#dc2626' }}>- {totalLoss} kg</td>
                          <td style={{ color: 'var(--primary-700)' }}>
                            {(data.totalDriverKilos - totalLoss).toLocaleString()} kg
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Algorithm Explanation */}
              {preview && totalLoss > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
                  padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#92400e',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <AlertTriangle size={16} />
                    <strong>Smart Deduction Algorithm / බර අඩු කිරීමේ ක්‍රමය</strong>
                  </div>
                  <p>Weight loss is distributed based on water scores. Score 0 (dry) gets <strong>no deduction</strong>.
                    Higher scores get proportionally more deduction.</p>
                  <p style={{ marginTop: '4px' }}>
                    ජල ලකුණු මත බර අඩු කිරීම බෙදා හරිනු ලැබේ. ලකුණු 0 (වියළි) සඳහා <strong>අඩු කිරීමක් නැත</strong>.
                  </p>
                </div>
              )}

              {/* Validate Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleValidate}
                  disabled={submitting || !warehouseKilos || parseFloat(warehouseKilos) <= 0}
                  style={{ minWidth: '200px' }}
                >
                  {submitting
                    ? <><Loader2 size={20} className="spin" /> Processing...</>
                    : <><CheckCircle size={20} /> Validate & Apply</>
                  }
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Success Result */}
      {result && (
        <div style={{
          marginTop: '24px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)',
          borderRadius: '12px', padding: '24px', textAlign: 'center',
        }}>
          <CheckCircle size={48} color="var(--primary-600)" />
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-800)', marginTop: '12px' }}>
            Validation Complete! / තහවුරු කිරීම සම්පූර්ණයි!
          </h3>
          <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>
            {result.deductions?.length} collections validated.
            Driver: {result.totalDriverKilos} kg → Warehouse: {result.totalWarehouseKilos} kg
            (Loss: {result.totalLoss} kg)
          </p>
        </div>
      )}
    </div>
  );
}
