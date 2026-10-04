'use client';

import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Calculator, CheckCircle, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import { printReceipt } from '@/lib/printReceipt';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Default: the period that contains today (after the 25th, that's next month's period)
function currentPeriodMonth() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 25 ? 1 : 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// e.g. "26 Sep 2026" (period dates are UTC midnight)
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function CommissionsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentPeriodMonth());
  const [pricePerKilo, setPricePerKilo] = useState('');

  const [year, month] = selectedMonth.split('-').map(Number);

  useEffect(() => { fetchCommissions(); }, [selectedMonth]);

  const fetchCommissions = async () => {
    if (!month || !year) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commissions?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setCommissions(data.commissions);
        setPeriod(data.period);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCalculate = async () => {
    if (!pricePerKilo) { showToast(t('payments.enterPrice'), 'warning'); return; }
    setCalculating(true);
    try {
      const res = await fetch('/api/commissions/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, pricePerKilo: parseFloat(pricePerKilo) }),
      });
      if (res.ok) {
        const skipped = parseInt(res.headers.get('X-Skipped-Paid') || '0');
        showToast(
          skipped > 0
            ? `${t('commissions.calculateSuccess')} (${skipped} already-paid commission(s) not changed)`
            : t('commissions.calculateSuccess'),
          'success'
        );
        fetchCommissions();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || t('common.error'), 'error');
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
    setCalculating(false);
  };

  const markPaid = async (id: number) => {
    if (payingId) return;
    setPayingId(id);
    const res = await fetch(`/api/commissions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true }) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || t('common.error'), 'error');
    }
    setPayingId(null);
    fetchCommissions();
  };

  const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);
  const periodLabel = period ? `${fmtDate(period.start)} – ${fmtDate(period.end)}` : '';

  const handlePrint = (c: any) => {
    printReceipt({
      type: 'commission',
      receiptNo: `COM-${c.id}`,
      date: new Date().toLocaleDateString(),
      driverName: c.driver?.name,
      totalKilos: c.totalKilos,
      pricePerKilo: c.pricePerKilo,
      commissionAmount: c.commissionAmount,
      month: `${months[month - 1]} (${periodLabel})`,
      year: year,
    });
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header"><h1>{t('commissions.title')}</h1></div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Month / මාසය</label>
              <input type="month" className="form-input" value={selectedMonth} onChange={(e) => e.target.value && setSelectedMonth(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('payments.pricePerKilo')}</label>
              <input type="number" step="0.01" className="form-input" value={pricePerKilo} onChange={(e) => setPricePerKilo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating}>
              <Calculator size={18} /> {calculating ? t('common.loading') : t('commissions.calculateCommissions')}
            </button>
          </div>
          {period && (
            <p style={{ marginTop: '12px', color: 'var(--gray-500)', fontSize: '13px' }}>
              Period / කාලය: <strong style={{ color: 'var(--gray-800)' }}>{periodLabel}</strong>
              {' '}· net kilos · tea added late for an earlier period is included and marked <span className="badge badge-amber" style={{ fontSize: '10px' }}>Late</span>
            </p>
          )}
        </div>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('collections.driver')}</th>
                <th>{t('commissions.totalKilos')}</th>
                <th>{t('payments.pricePerKilo')}</th>
                <th>{t('commissions.commissionAmount')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
              ) : commissions.map((c, i) => (
                <Fragment key={c.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      {expanded === c.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {c.driver?.name}
                      <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontWeight: 400 }}>{c.collections.length} collections</div>
                    </td>
                    <td>{c.totalKilos.toLocaleString()} {t('common.kg')}</td>
                    <td>{t('common.rs')} {c.pricePerKilo}</td>
                    <td className="amount amount-positive">{t('common.rs')} {c.commissionAmount.toLocaleString()}</td>
                    <td><span className={`badge ${c.paid ? 'badge-green' : 'badge-amber'}`}>{c.paid ? t('common.paid') : t('common.unpaid')}</span></td>
                    <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                      {!c.paid && (
                        <button className="btn btn-sm btn-primary" onClick={() => markPaid(c.id)} disabled={payingId !== null}>
                          <CheckCircle size={14} /> {t('commissions.markAsPaid')}
                        </button>
                      )}
                      <button className="btn btn-sm btn-outline" onClick={() => handlePrint(c)} title="Print Receipt">
                        <Printer size={14} /> Print
                      </button>
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--gray-50)', padding: '8px 16px 16px' }}>
                        <table className="table" style={{ fontSize: '13px' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Customer</th>
                              <th>Gross</th>
                              <th>Water</th>
                              <th>Packaging</th>
                              <th>Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.collections.map((col: any) => (
                              <tr key={col.id}>
                                <td>
                                  {fmtDate(col.collectionDate)}
                                  {col.late && <span className="badge badge-amber" style={{ fontSize: '10px', marginLeft: '6px' }}>Late</span>}
                                </td>
                                <td>{col.customer?.name}</td>
                                <td>{col.kilosByDriver} kg</td>
                                <td>{col.waterDeduction > 0 ? `- ${col.waterDeduction} kg` : '-'}</td>
                                <td>{col.packagingDeduction > 0 ? `- ${col.packagingDeduction} kg` : '-'}</td>
                                <td style={{ fontWeight: 600 }}>{col.kilosValidated} kg</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            {commissions.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>{t('common.total')}</td>
                  <td className="amount amount-positive" style={{ fontSize: '16px' }}>{t('common.rs')} {totalCommission.toLocaleString()}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
