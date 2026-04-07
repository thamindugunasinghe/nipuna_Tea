'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, ShoppingCart, Printer } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';
import { printReceipt } from '@/lib/printReceipt';

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [fertilisers, setFertilisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerId: '', itemType: 'grocery', fertiliserId: '', description: '',
    quantity: '1', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/purchases').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/fertilisers').then(r => r.json()),
    ]).then(([purs, custs, ferts]) => {
      setPurchases(purs);
      setCustomers(custs.filter((c: any) => c.type === 'regular'));
      setFertilisers(ferts);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalCost = parseFloat(form.quantity || '0') * parseFloat(form.unitPrice || '0');

  const handleFertiliserChange = (id: string) => {
    setForm({ ...form, fertiliserId: id });
    if (id) {
      const fert = fertilisers.find(f => f.id === parseInt(id));
      if (fert) setForm(prev => ({ ...prev, fertiliserId: id, unitPrice: String(fert.pricePerUnit), description: fert.name }));
    }
  };

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(form.customerId),
          itemType: form.itemType,
          fertiliserId: form.fertiliserId ? parseInt(form.fertiliserId) : null,
          description: form.description,
          quantity: parseFloat(form.quantity),
          unitPrice: parseFloat(form.unitPrice),
          totalCost,
          purchaseDate: form.purchaseDate,
        }),
      });
      if (res.ok) {
        showToast(t('purchases.addSuccess'), 'success');
        setShowModal(false);
        setPurchases(await fetch('/api/purchases').then(r => r.json()));
        setForm({ customerId: '', itemType: 'grocery', fertiliserId: '', description: '', quantity: '1', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0] });
      } else {
        showToast(t('common.error'), 'error');
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const handlePrint = (p: any) => {
    printReceipt({
      type: 'credit',
      receiptNo: `CRD-${p.id}`,
      date: new Date(p.purchaseDate).toLocaleDateString(),
      customerName: p.customer?.name,
      itemType: p.itemType,
      description: p.description || p.fertiliser?.name || '-',
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      totalCost: p.totalCost,
    });
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('purchases.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> {t('purchases.addPurchase')}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('common.date')}</th>
              <th>{t('collections.customer')}</th>
              <th>{t('purchases.itemType')}</th>
              <th>{t('purchases.description')}</th>
              <th>{t('purchases.quantity')}</th>
              <th>{t('purchases.unitPrice')}</th>
              <th>{t('purchases.totalCost')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
            ) : purchases.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td style={{ fontWeight: 600 }}>{p.customer?.name}</td>
                <td><span className={`badge ${p.itemType === 'grocery' ? 'badge-blue' : 'badge-amber'}`}>{t(`purchases.${p.itemType}`)}</span></td>
                <td>{p.description || '-'}</td>
                <td>{p.quantity}</td>
                <td>{t('common.rs')} {p.unitPrice?.toLocaleString()}</td>
                <td className="amount">{t('common.rs')} {p.totalCost?.toLocaleString()}</td>
                <td><span className={`badge ${p.settled ? 'badge-green' : 'badge-amber'}`}>{p.settled ? t('common.settled') : t('common.pending')}</span></td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handlePrint(p)} title="Print Receipt">
                    <Printer size={14} /> Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('purchases.addPurchase')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('purchases.selectCustomer')} *</label>
          <select className="form-select" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t('purchases.selectCustomer')}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('purchases.itemType')} *</label>
          <select className="form-select" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value, fertiliserId: '', description: '' })}>
            <option value="grocery">{t('purchases.grocery')}</option>
            <option value="fertiliser">{t('purchases.fertiliser')}</option>
          </select>
        </div>
        {form.itemType === 'fertiliser' && (
          <div className="form-group">
            <label className="form-label">{t('purchases.selectFertiliser')}</label>
            <select className="form-select" value={form.fertiliserId} onChange={(e) => handleFertiliserChange(e.target.value)}>
              <option value="">{t('purchases.selectFertiliser')}</option>
              {fertilisers.map(f => <option key={f.id} value={f.id}>{f.name} - {t('common.rs')} {f.pricePerUnit}</option>)}
            </select>
          </div>
        )}
        {form.itemType === 'grocery' && (
          <div className="form-group">
            <label className="form-label">{t('purchases.description')}</label>
            <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('purchases.quantity')} *</label>
            <input type="number" step="0.1" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('purchases.unitPrice')} *</label>
            <input type="number" step="0.01" className="form-input" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('purchases.totalCost')}</label>
          <div className="amount amount-negative" style={{ fontSize: '20px', padding: '10px' }}>{t('common.rs')} {totalCost.toLocaleString()}</div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('purchases.purchaseDate')}</label>
          <input type="date" className="form-input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
