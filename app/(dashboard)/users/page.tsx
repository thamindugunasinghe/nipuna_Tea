'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';

export default function UsersPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'staff' });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showToast(t('users.addSuccess'), 'success');
        setShowModal(false);
        fetchUsers();
        setForm({ username: '', password: '', name: '', role: 'staff' });
      } else {
        const data = await res.json();
        showToast(data.error || t('common.error'), 'error');
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    await fetch(`/api/users/${id}`, { method: 'DELETE' });
    fetchUsers();
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('users.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> {t('users.addUser')}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('users.username')}</th>
              <th>{t('users.name')}</th>
              <th>{t('users.role')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{u.username}</td>
                <td>{u.name}</td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>
                    {u.role === 'admin' ? t('users.admin') : t('users.staff')}
                  </span>
                </td>
                <td><span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>{u.active ? t('common.active') : t('common.inactive')}</span></td>
                <td>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(u.id)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('users.addUser')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('users.username')} *</label>
          <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('users.password')} *</label>
          <input type="password" className="form-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('users.name')} *</label>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('users.role')}</label>
          <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">{t('users.staff')}</option>
            <option value="admin">{t('users.admin')}</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
