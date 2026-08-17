'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, Leaf, CheckCircle, Droplets } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';

export default function CollectionsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [collections, setCollections] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [lorries, setLorries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    customerId: '', driverId: '', lorryId: '', kilosByDriver: '', waterDeduction: '0',
    collectionDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/collections').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/fleet/drivers').then(r => r.json()),
      fetch('/api/fleet/lorries').then(r => r.json()),
    ]).then(([cols, custs, drvs, lrrs]) => {
      setCollections(cols);
      setCustomers(custs);
      setDrivers(drvs);
      setLorries(lrrs);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: parseInt(form.customerId),
          driverId: form.driverId ? parseInt(form.driverId) : null,
          lorryId: form.lorryId ? parseInt(form.lorryId) : null,
          kilosByDriver: parseFloat(form.kilosByDriver),
          waterDeduction: parseFloat(form.waterDeduction) || 0,
          collectionDate: form.collectionDate,
        }),
      });
      if (res.ok) {
        showToast(t('collections.addSuccess'), 'success');
        setShowModal(false);
        const data = await fetch('/api/collections').then(r => r.json());
        setCollections(data);
        setForm({ customerId: '', driverId: '', lorryId: '', kilosByDriver: '', waterDeduction: '0', collectionDate: new Date().toISOString().split('T')[0] });
      } else {
        const data = await res.json();
        showToast(data.error || t('common.error'), 'error');
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const filtered = collections.filter(c => {
    if (!dateFilter) return true;
    return c.collectionDate?.split('T')[0] === dateFilter;
  });

  const dailyTotal = filtered.reduce((sum, c) => sum + (c.kilosValidated || c.kilosByDriver), 0);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('collections.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> {t('collections.addCollection')}
        </button>
      </div>

      <div className="filter-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input type="date" className="form-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
        <div className="stat-card" style={{ padding: '12px 20px', gap: '10px' }}>
          <Leaf size={20} className="amount-positive" />
          <div><span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{t('collections.dailyTotal')}</span>
            <div className="amount amount-positive" style={{ fontSize: '18px' }}>{dailyTotal.toLocaleString()} {t('common.kg')}</div>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('collections.customer')}</th>
              <th>{t('collections.driver')}</th>
              <th>{t('collections.lorry')}</th>
              <th>{t('collections.kilosByDriver')}</th>
              <th>Water Deduction / ජල අඩු කිරීම</th>
              <th>Net Kilos / ශුද්ධ බර</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
            ) : filtered.map((c, i) => {
              const deduction = c.waterDeduction || 0;
              const netKilos = c.kilosValidated ?? (c.kilosByDriver - deduction);
              return (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{c.customer?.name}</td>
                  <td>{c.driver?.name || '-'}</td>
                  <td>{c.lorry?.lorryNumber || '-'}</td>
                  <td>{c.kilosByDriver} {t('common.kg')}</td>
                  <td>
                    {deduction > 0 ? (
                      <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Droplets size={12} />
                        - {deduction} {t('common.kg')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--gray-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-green">
                      <CheckCircle size={14} style={{ marginRight: 4 }} />
                      {netKilos} {t('common.kg')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('collections.addCollection')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('collections.collectionDate')} *</label>
          <input type="date" className="form-input" value={form.collectionDate} onChange={(e) => setForm({ ...form, collectionDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('collections.customer')} *</label>
          <select className="form-select" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t('collections.selectCustomer')}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('collections.driver')}</label>
            <select className="form-select" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">{t('collections.selectDriver')}</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('collections.lorry')}</label>
            <select className="form-select" value={form.lorryId} onChange={(e) => setForm({ ...form, lorryId: e.target.value })}>
              <option value="">{t('collections.selectLorry')}</option>
              {lorries.map(l => <option key={l.id} value={l.id}>{l.lorryNumber}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('collections.kilosByDriver')} *</label>
            <input type="number" step="0.1" className="form-input" placeholder={t('collections.enterKilos')}
              value={form.kilosByDriver} onChange={(e) => setForm({ ...form, kilosByDriver: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Water Deduction (kg) / ජල අඩු කිරීම</label>
            <input type="number" step="0.1" min="0" className="form-input" placeholder="0"
              value={form.waterDeduction} onChange={(e) => setForm({ ...form, waterDeduction: e.target.value })} />
          </div>
        </div>
        {/* Net Kilos Preview */}
        {form.kilosByDriver && (
          <div style={{
            background: 'var(--primary-50)', borderRadius: '8px', padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>Net Kilos / ශුද්ධ බර:</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-700)' }}>
              {Math.max(0, (parseFloat(form.kilosByDriver) || 0) - (parseFloat(form.waterDeduction) || 0)).toFixed(1)} kg
            </span>
          </div>
        )}
      </Modal>
    </div>
  );
}
