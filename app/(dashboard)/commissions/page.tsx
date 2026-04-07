'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Calculator, CheckCircle, Printer } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import { printReceipt } from '@/lib/printReceipt';

export default function CommissionsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [pricePerKilo, setPricePerKilo] = useState('');
  const [commissionRate, setCommissionRate] = useState('5');

  useEffect(() => { fetchCommissions(); }, [month, year]);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commissions?month=${month}&year=${year}`);
      if (res.ok) setCommissions(await res.json());
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
        body: JSON.stringify({ month, year, pricePerKilo: parseFloat(pricePerKilo), commissionRate: parseFloat(commissionRate) }),
      });
      if (res.ok) { showToast(t('commissions.calculateSuccess'), 'success'); fetchCommissions(); }
      else showToast(t('common.error'), 'error');
    } catch (e) { showToast(t('common.error'), 'error'); }
    setCalculating(false);
  };

  const markPaid = async (id: number) => {
    await fetch(`/api/commissions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true }) });
    fetchCommissions();
  };

  const totalCommission = commissions.reduce((s, c) => s + c.commissionAmount, 0);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handlePrint = (c: any) => {
    printReceipt({
      type: 'commission',
      receiptNo: `COM-${c.id}`,
      date: new Date().toLocaleDateString(),
      driverName: c.driver?.name,
      totalKilos: c.totalKilos,
      pricePerKilo: c.pricePerKilo,
      commissionRate: c.commissionRate,
      commissionAmount: c.commissionAmount,
      month: months[month - 1],
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
              <label className="form-label">{t('payments.selectMonth')}</label>
              <select className="form-select" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('payments.selectYear')}</label>
              <select className="form-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('payments.pricePerKilo')}</label>
              <input type="number" step="0.01" className="form-input" value={pricePerKilo} onChange={(e) => setPricePerKilo(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t('commissions.commissionRate')}</label>
              <input type="number" step="0.1" className="form-input" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating}>
              <Calculator size={18} /> {calculating ? t('common.loading') : t('commissions.calculateCommissions')}
            </button>
          </div>
          <p className="form-help" style={{ marginTop: '12px' }}>{t('commissions.formula')}</p>
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
                <th>{t('commissions.commissionRate')}</th>
                <th>{t('commissions.commissionAmount')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
              ) : commissions.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{c.driver?.name}</td>
                  <td>{c.totalKilos.toLocaleString()} {t('common.kg')}</td>
                  <td>{t('common.rs')} {c.pricePerKilo}</td>
                  <td>{c.commissionRate}%</td>
                  <td className="amount amount-positive">{t('common.rs')} {c.commissionAmount.toLocaleString()}</td>
                  <td><span className={`badge ${c.paid ? 'badge-green' : 'badge-amber'}`}>{c.paid ? t('common.paid') : t('common.unpaid')}</span></td>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {!c.paid && (
                      <button className="btn btn-sm btn-primary" onClick={() => markPaid(c.id)}>
                        <CheckCircle size={14} /> {t('commissions.markAsPaid')}
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline" onClick={() => handlePrint(c)} title="Print Receipt">
                      <Printer size={14} /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {commissions.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right' }}>{t('common.total')}</td>
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
