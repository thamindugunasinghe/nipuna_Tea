'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';
import Link from 'next/link';

interface Customer {
  id: number;
  name: string;
  nic: string | null;
  phone: string | null;
  address: string | null;
  type: string;
  active: boolean;
  _count?: { teaCollections: number; creditPurchases: number };
}

export default function CustomersPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', nic: '', phone: '', address: '', type: 'regular' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) setCustomers(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const openAdd = () => {
    setEditCustomer(null);
    setForm({ name: '', nic: '', phone: '', address: '', type: 'regular' });
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({ name: c.name, nic: c.nic || '', phone: c.phone || '', address: c.address || '', type: c.type });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const method = editCustomer ? 'PUT' : 'POST';
      const url = editCustomer ? `/api/customers/${editCustomer.id}` : '/api/customers';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showToast(editCustomer ? t('customers.updateSuccess') : t('customers.registerSuccess'), 'success');
        setShowModal(false);
        fetchCustomers();
      } else {
        const data = await res.json();
        showToast(data.error || t('common.error'), 'error');
      }
    } catch (e) {
      showToast(t('common.error'), 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('customers.deleteConfirm'))) return;
    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      showToast(t('common.success'), 'success');
      fetchCustomers();
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const filtered = customers.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.nic && c.nic.includes(search));
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('customers.title')}</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} /> {t('customers.addCustomer')}
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search />
          <input
            type="text"
            className="form-input"
            placeholder={t('customers.searchByName')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t('common.all')}</option>
          <option value="regular">{t('common.regular')}</option>
          <option value="non-regular">{t('common.nonRegular')}</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('customers.name')}</th>
              <th>{t('customers.nic')}</th>
              <th>{t('customers.phone')}</th>
              <th>{t('customers.type')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.nic || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>
                  <span className={`badge ${c.type === 'regular' ? 'badge-green' : 'badge-gray'}`}>
                    {c.type === 'regular' ? t('common.regular') : t('common.nonRegular')}
                  </span>
                </td>
                <td>
                  <span className={`badge ${c.active ? 'badge-green' : 'badge-red'}`}>
                    {c.active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Link href={`/customers/${c.id}`} className="btn btn-ghost btn-icon" title={t('common.view')}>
                      <Eye size={16} />
                    </Link>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEdit(c)} title={t('common.edit')}>
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(c.id)} title={t('common.delete')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editCustomer ? t('customers.editCustomer') : t('customers.addCustomer')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave}>{t('common.save')}</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">{t('customers.name')} *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('customers.nic')}</label>
            <input className="form-input" value={form.nic} onChange={(e) => setForm({ ...form, nic: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('customers.phone')}</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('customers.address')}</label>
          <textarea className="form-textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('customers.type')}</label>
          <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="regular">{t('customers.regular')}</option>
            <option value="non-regular">{t('customers.nonRegular')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
