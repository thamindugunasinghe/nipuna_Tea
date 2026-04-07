'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Calculator, CheckCircle, Printer } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import { printReceipt } from '@/lib/printReceipt';

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [pricePerKilo, setPricePerKilo] = useState('');

  useEffect(() => { fetchPayments(); }, [month, year]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?month=${month}&year=${year}`);
      if (res.ok) setPayments(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCalculate = async () => {
    if (!pricePerKilo) { showToast(t('payments.enterPrice'), 'warning'); return; }
    setCalculating(true);
    try {
      const res = await fetch('/api/payments/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, pricePerKilo: parseFloat(pricePerKilo) }),
      });
      if (res.ok) {
        showToast(t('payments.calculateSuccess'), 'success');
        fetchPayments();
      } else {
        const data = await res.json();
        showToast(data.error || t('common.error'), 'error');
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
    setCalculating(false);
  };

  const markPaid = async (id: number) => {
    await fetch(`/api/payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: true }) });
    fetchPayments();
  };

  const totalNet = payments.reduce((s, p) => s + p.netPayment, 0);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrint = (p: any) => {
    printReceipt({
      type: 'payment',
      receiptNo: `PAY-${p.id}`,
      date: new Date().toLocaleDateString(),
      customerName: p.customer?.name,
      totalKilos: p.totalKilos,
      pricePerKilo: p.pricePerKilo,
      grossPayment: p.grossPayment,
      groceryDeduction: p.groceryDeduction,
      fertiliserDeduction: p.fertiliserDeduction,
      otherDeduction: p.otherDeductionAmt,
      netPayment: p.netPayment,
      month: months[month - 1],
      year: year,
    });
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('payments.title')}</h1>
      </div>

      {/* Controls */}
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
              <input type="number" step="0.01" className="form-input" value={pricePerKilo} onChange={(e) => setPricePerKilo(e.target.value)} placeholder={t('payments.enterPrice')} />
            </div>
            <button className="btn btn-primary" onClick={handleCalculate} disabled={calculating}>
              <Calculator size={18} /> {calculating ? t('common.loading') : t('payments.calculatePayments')}
            </button>
          </div>
          <p className="form-help" style={{ marginTop: '12px' }}>{t('payments.calculationFormula')}</p>
        </div>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('collections.customer')}</th>
                <th>{t('payments.totalKilos')}</th>
                <th>{t('payments.grossPayment')}</th>
                <th>{t('payments.groceryDeduction')}</th>
                <th>{t('payments.fertiliserDeduction')}</th>
                <th>{t('payments.otherDeduction')}</th>
                <th>{t('payments.netPayment')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
              ) : payments.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.customer?.name}</td>
                  <td>{p.totalKilos.toLocaleString()} {t('common.kg')}</td>
                  <td>{t('common.rs')} {p.grossPayment.toLocaleString()}</td>
                  <td className="amount-negative">{t('common.rs')} {p.groceryDeduction.toLocaleString()}</td>
                  <td className="amount-negative">{t('common.rs')} {p.fertiliserDeduction.toLocaleString()}</td>
                  <td className="amount-negative">{t('common.rs')} {p.otherDeductionAmt.toLocaleString()}</td>
                  <td className="amount amount-positive" style={{ fontSize: '15px' }}>{t('common.rs')} {p.netPayment.toLocaleString()}</td>
                  <td><span className={`badge ${p.paid ? 'badge-green' : 'badge-amber'}`}>{p.paid ? t('common.paid') : t('common.unpaid')}</span></td>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {!p.paid && (
                      <button className="btn btn-sm btn-primary" onClick={() => markPaid(p.id)}>
                        <CheckCircle size={14} /> {t('payments.markAsPaid')}
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline" onClick={() => handlePrint(p)} title="Print Receipt">
                      <Printer size={14} /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'right' }}>{t('common.total')}</td>
                  <td className="amount amount-positive" style={{ fontSize: '16px' }}>{t('common.rs')} {totalNet.toLocaleString()}</td>
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
