'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Scale, Droplets, CheckCircle, Search, AlertTriangle, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';

export default function ValidationPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [lorries, setLorries] = useState<any[]>([]);
  const [lorryId, setLorryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [lorryScaleKilos, setLorryScaleKilos] = useState('');
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
    setLorryScaleKilos('');
    try {
      const url = lorryId === 'warehouse'
          ? `/api/validation?warehouse=true&date=${date}`
          : `/api/validation?lorryId=${lorryId}&date=${date}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.existingValidation) {
          setLorryScaleKilos(String(d.existingValidation.lorryScaleKilos || d.existingValidation.totalWarehouseKilos || ''));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleValidate = async () => {
    if (!lorryScaleKilos || parseFloat(lorryScaleKilos) <= 0) {
      showToast('Enter the lorry scale weight / ලොරි කිරුම බර ඇතුළත් කරන්න', 'warning');
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
          lorryScaleKilos: parseFloat(lorryScaleKilos),
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

  // Calculate preview
  const parsedLorryScale = parseFloat(lorryScaleKilos || '0');
  const previewDiff = data ? Math.round((parsedLorryScale - data.totalGrossKilos) * 100) / 100 : 0;

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
              {data.existingValidation && (
                <div style={{
                  background: 'var(--primary-50)', border: '1px solid var(--primary-200)',
                  borderRadius: '10px', padding: '14px 18px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--primary-800)',
                }}>
                  <CheckCircle size={20} />
                  <div>
                    <strong>Already validated!</strong> Lorry Scale: {data.existingValidation.lorryScaleKilos || data.existingValidation.totalWarehouseKilos} kg,
                    Difference: {data.existingValidation.lorryCumulativeDiff || 0} kg.
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)', marginLeft: '6px' }}>
                      Re-submitting will update the existing validation.
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="stats-grid" style={{ marginBottom: '20px' }}>
                {/* Gross Kilos */}
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}><Scale size={24} /></div>
                  <div className="stat-content">
                    <h3>Gross Total / මුළු බර</h3>
                    <div className="stat-value">{data.totalGrossKilos.toLocaleString()}</div>
                    <div className="stat-sub">kg (before deductions) — {data.collectionsCount} collections</div>
                  </div>
                </div>

                {/* Water Deduction Total */}
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}><Droplets size={24} /></div>
                  <div className="stat-content">
                    <h3>Water Deduction / ජල අඩු කිරීම</h3>
                    <div className="stat-value" style={{ color: '#dc2626' }}>- {data.totalWaterDeduction.toLocaleString()}</div>
                    <div className="stat-sub">kg deducted by rider</div>
                  </div>
                </div>

                {/* Net Kilos (Cumulative) */}
                <div className="stat-card">
                  <div className="stat-icon green"><Scale size={24} /></div>
                  <div className="stat-content">
                    <h3>Net Total / ශුද්ධ බර</h3>
                    <div className="stat-value">{data.totalNetKilos.toLocaleString()}</div>
                    <div className="stat-sub">kg (after deductions)</div>
                  </div>
                </div>

                {/* Lorry Scale Input */}
                <div className="stat-card">
                  <div className="stat-icon blue"><Scale size={24} /></div>
                  <div className="stat-content">
                    <h3>Lorry Scale / ලොරි කිරුම බර</h3>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={lorryScaleKilos}
                      onChange={(e) => setLorryScaleKilos(e.target.value)}
                      placeholder="Enter lorry weight..."
                      style={{ maxWidth: '180px', fontSize: '20px', fontWeight: 700, marginTop: '4px' }}
                    />
                  </div>
                </div>

                {/* Difference */}
                {lorryScaleKilos && (
                  <div className="stat-card">
                    <div className="stat-icon" style={{
                      background: Math.abs(previewDiff) > 10 ? '#fee2e2' : '#dcfce7',
                      color: Math.abs(previewDiff) > 10 ? '#dc2626' : '#16a34a',
                    }}>
                      {previewDiff >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <div className="stat-content">
                      <h3>Difference / වෙනස</h3>
                      <div className="stat-value" style={{
                        color: Math.abs(previewDiff) > 10 ? '#dc2626' : '#16a34a',
                      }}>
                        {previewDiff > 0 ? '+' : ''}{previewDiff} kg
                      </div>
                      <div className="stat-sub">
                        {previewDiff > 0 ? 'Lorry shows more than collected gross / ලොරිය එකතු කළ මුළු බරට වඩා වැඩිය' :
                         previewDiff < 0 ? 'Lorry shows less than collected gross / ලොරිය එකතු කළ මුළු බරට වඩා අඩුය' :
                         'No difference / වෙනසක් නැත'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collections Table */}
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
                        <th>Gross Kilos</th>
                        <th style={{ color: '#dc2626' }}>Water Deduction</th>
                        <th>Net Kilos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.collections.map((c: any, i: number) => {
                        const deduction = c.waterDeduction || 0;
                        const netKilos = c.kilosValidated ?? (c.kilosByDriver - deduction);
                        return (
                          <tr key={c.id}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{c.customer?.name}</td>
                            <td>{c.driver?.name || '-'}</td>
                            <td>{c.kilosByDriver} kg</td>
                            <td style={{ color: '#dc2626', fontWeight: 600 }}>
                              {deduction > 0 ? `- ${deduction} kg` : '—'}
                            </td>
                            <td>
                              <span className="badge badge-green">
                                <CheckCircle size={12} style={{ marginRight: 4 }} />
                                {netKilos} kg
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                        <td colSpan={3}>Total</td>
                        <td>{data.totalGrossKilos} kg</td>
                        <td style={{ color: '#dc2626' }}>- {data.totalWaterDeduction} kg</td>
                        <td style={{ color: 'var(--primary-700)' }}>
                          {data.totalNetKilos.toLocaleString()} kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Explanation */}
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
                padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#92400e',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} />
                  <strong>How it works / ක්‍රියා කරන ආකාරය</strong>
                </div>
                <p>Net kilos for each customer = Gross kilos − Water deduction (entered by rider).
                  The lorry scale weight is compared with the cumulative gross total to find any difference.
                  This difference is saved for reports only — customer payments are based on their net kilos.</p>
                <p style={{ marginTop: '4px' }}>
                  සෑම ගනුදෙනුකරුවෙකුටම ශුද්ධ කිලෝ = මුළු බර − ජල අඩු කිරීම (රියදුරු විසින් ඇතුළත් කළ).
                  ලොරි කිරුම බර සමස්ත මුළු බර සමඟ සංසන්දනය කරනු ලැබේ.
                </p>
              </div>

              {/* Validate Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleValidate}
                  disabled={submitting || !lorryScaleKilos || parseFloat(lorryScaleKilos) <= 0}
                  style={{ minWidth: '200px' }}
                >
                  {submitting
                    ? <><Loader2 size={20} className="spin" /> Processing...</>
                    : <><CheckCircle size={20} /> Validate & Save</>
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
            {result.customerSummary?.length} collections recorded.
            Gross: {result.totalGrossKilos} kg →
            Net: {result.totalNetKilos} kg →
            Lorry Scale: {result.lorryScaleKilos} kg
            (Difference: {result.lorryCumulativeDiff > 0 ? '+' : ''}{result.lorryCumulativeDiff} kg)
          </p>
        </div>
      )}
    </div>
  );
}
