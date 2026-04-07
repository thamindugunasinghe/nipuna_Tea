'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, Truck, User, Edit2, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';

export default function FleetPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [tab, setTab] = useState<'lorries' | 'drivers'>('lorries');
  const [lorries, setLorries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLorryModal, setShowLorryModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [lorryForm, setLorryForm] = useState({ lorryNumber: '', capacity: '' });
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', nic: '', lorryId: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/fleet/lorries').then(r => r.json()),
      fetch('/api/fleet/drivers').then(r => r.json()),
    ]).then(([l, d]) => { setLorries(l); setDrivers(d); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const [l, d] = await Promise.all([
      fetch('/api/fleet/lorries').then(r => r.json()),
      fetch('/api/fleet/drivers').then(r => r.json()),
    ]);
    setLorries(l); setDrivers(d);
  };

  const saveLorry = async () => {
    try {
      const res = await fetch('/api/fleet/lorries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lorryNumber: lorryForm.lorryNumber, capacity: lorryForm.capacity ? parseFloat(lorryForm.capacity) : null }),
      });
      if (res.ok) { showToast(t('fleet.addLorrySuccess'), 'success'); setShowLorryModal(false); refresh(); setLorryForm({ lorryNumber: '', capacity: '' }); }
      else showToast(t('common.error'), 'error');
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const saveDriver = async () => {
    try {
      const res = await fetch('/api/fleet/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...driverForm, lorryId: driverForm.lorryId ? parseInt(driverForm.lorryId) : null }),
      });
      if (res.ok) { showToast(t('fleet.addDriverSuccess'), 'success'); setShowDriverModal(false); refresh(); setDriverForm({ name: '', phone: '', nic: '', lorryId: '' }); }
      else showToast(t('common.error'), 'error');
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const deleteLorry = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    await fetch(`/api/fleet/lorries/${id}`, { method: 'DELETE' });
    refresh();
  };

  const deleteDriver = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    await fetch(`/api/fleet/drivers/${id}`, { method: 'DELETE' });
    refresh();
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('fleet.title')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary" onClick={() => tab === 'lorries' ? setShowLorryModal(true) : setShowDriverModal(true)}>
            <Plus size={18} /> {tab === 'lorries' ? t('fleet.addLorry') : t('fleet.addDriver')}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'lorries' ? 'active' : ''}`} onClick={() => setTab('lorries')}>
          <Truck size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> {t('fleet.lorries')}
        </button>
        <button className={`tab ${tab === 'drivers' ? 'active' : ''}`} onClick={() => setTab('drivers')}>
          <User size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> {t('fleet.drivers')}
        </button>
      </div>

      {tab === 'lorries' ? (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>#</th><th>{t('fleet.lorryNumber')}</th><th>{t('fleet.capacity')}</th><th>{t('fleet.drivers')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {lorries.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
              : lorries.map((l, i) => (
                <tr key={l.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{l.lorryNumber}</td>
                  <td>{l.capacity ? `${l.capacity} ${t('common.kg')}` : '-'}</td>
                  <td>{l.drivers?.map((d: any) => d.name).join(', ') || '-'}</td>
                  <td><button className="btn btn-ghost btn-icon" onClick={() => deleteLorry(l.id)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>#</th><th>{t('fleet.driverName')}</th><th>{t('fleet.phone')}</th><th>{t('fleet.nic')}</th><th>{t('fleet.assignedLorry')}</th><th>{t('common.actions')}</th></tr></thead>
            <tbody>
              {drivers.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
              : drivers.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td>{d.phone || '-'}</td>
                  <td>{d.nic || '-'}</td>
                  <td>{d.lorry?.lorryNumber || '-'}</td>
                  <td><button className="btn btn-ghost btn-icon" onClick={() => deleteDriver(d.id)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lorry Modal */}
      <Modal isOpen={showLorryModal} onClose={() => setShowLorryModal(false)} title={t('fleet.addLorry')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowLorryModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={saveLorry}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('fleet.lorryNumber')} *</label>
          <input className="form-input" value={lorryForm.lorryNumber} onChange={(e) => setLorryForm({ ...lorryForm, lorryNumber: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('fleet.capacity')}</label>
          <input type="number" className="form-input" value={lorryForm.capacity} onChange={(e) => setLorryForm({ ...lorryForm, capacity: e.target.value })} />
        </div>
      </Modal>

      {/* Driver Modal */}
      <Modal isOpen={showDriverModal} onClose={() => setShowDriverModal(false)} title={t('fleet.addDriver')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowDriverModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={saveDriver}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('fleet.driverName')} *</label>
          <input className="form-input" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('fleet.phone')}</label>
            <input className="form-input" value={driverForm.phone} onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('fleet.nic')}</label>
            <input className="form-input" value={driverForm.nic} onChange={(e) => setDriverForm({ ...driverForm, nic: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('fleet.assignedLorry')}</label>
          <select className="form-select" value={driverForm.lorryId} onChange={(e) => setDriverForm({ ...driverForm, lorryId: e.target.value })}>
            <option value="">-</option>
            {lorries.map(l => <option key={l.id} value={l.id}>{l.lorryNumber}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}
