'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Save, Plus, Trash2, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [settings, setSettings] = useState<any>({ tea_price_per_kilo: '', commission_rate: '5', other_deduction_rate: '5' });
  const [fertilisers, setFertilisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [fertForm, setFertForm] = useState({ name: '', pricePerUnit: '', weightPerBag: '' });

  // Clear Data OTP states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/api/fertilisers').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([s, f]) => {
      if (s && typeof s === 'object') {
        const mapped: any = {};
        if (Array.isArray(s)) s.forEach((item: any) => { mapped[item.key] = item.value; });
        else Object.assign(mapped, s);
        setSettings((prev: any) => ({ ...prev, ...mapped }));
      }
      setFertilisers(Array.isArray(f) ? f : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      showToast(t('settings.saveSuccess'), 'success');
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const addFertiliser = async () => {
    try {
      const res = await fetch('/api/fertilisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fertForm.name,
          pricePerUnit: parseFloat(fertForm.pricePerUnit),
          weightPerBag: fertForm.weightPerBag ? parseFloat(fertForm.weightPerBag) : null,
        }),
      });
      if (res.ok) {
        showToast(t('common.success'), 'success');
        setShowModal(false);
        setFertilisers(await fetch('/api/fertilisers').then(r => r.json()));
        setFertForm({ name: '', pricePerUnit: '', weightPerBag: '' });
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const deleteFertiliser = async (id: number) => {
    if (!confirm(t('common.confirm'))) return;
    await fetch(`/api/fertilisers/${id}`, { method: 'DELETE' });
    setFertilisers(await fetch('/api/fertilisers').then(r => r.json()));
  };

  // Clear Data Flow
  const handleClearDataClick = () => {
    setShowClearConfirm(true);
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const res = await fetch('/api/otp/send', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setShowClearConfirm(false);
        setShowOtpModal(true);
        setOtpSent(true);
        setOtpCode('');
        showToast('OTP sent to registered mobile number / OTP යවන ලදී', 'success');
      } else {
        showToast(data.error || 'Failed to send OTP', 'error');
      }
    } catch (e) {
      showToast('Failed to send OTP', 'error');
    }
    setSendingOtp(false);
  };

  const handleVerifyAndClear = async () => {
    if (otpCode.length !== 6) {
      showToast('Please enter the 6-digit OTP / කරුණාකර ඉලක්කම් 6 OTP ඇතුළත් කරන්න', 'warning');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/otp/verify-clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowOtpModal(false);
        setOtpCode('');
        setOtpSent(false);
        showToast('All data cleared successfully! / සියලුම දත්ත ඉවත් කරන ලදී!', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(data.error || 'Verification failed', 'error');
      }
    } catch (e) {
      showToast('Verification failed', 'error');
    }
    setVerifying(false);
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header"><h1>{t('settings.title')}</h1></div>

      <div style={{ display: 'grid', gap: '24px', maxWidth: '800px' }}>
        {/* System Settings */}
        <div className="card">
          <div className="card-header"><h2>{t('settings.title')}</h2></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{t('settings.teaPrice')}</label>
              <input type="number" step="0.01" className="form-input" value={settings.tea_price_per_kilo}
                onChange={(e) => setSettings({ ...settings, tea_price_per_kilo: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('settings.commissionRate')}</label>
                <input type="number" step="0.1" className="form-input" value={settings.commission_rate}
                  onChange={(e) => setSettings({ ...settings, commission_rate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.otherDeduction')}</label>
                <input type="number" step="0.1" className="form-input" value={settings.other_deduction_rate}
                  onChange={(e) => setSettings({ ...settings, other_deduction_rate: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveSettings}><Save size={18} /> {t('common.save')}</button>
          </div>
        </div>

        {/* Fertiliser Management */}
        <div className="card">
          <div className="card-header">
            <h2>{t('settings.fertiliserManagement')}</h2>
            <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> {t('settings.addFertiliser')}</button>
          </div>
          <div className="card-body">
            {fertilisers.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>{t('common.noData')}</p>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead><tr><th>{t('settings.fertiliserName')}</th><th>{t('settings.pricePerUnit')}</th><th>{t('settings.weightPerBag')}</th><th>{t('common.actions')}</th></tr></thead>
                  <tbody>
                    {fertilisers.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 600 }}>{f.name}</td>
                        <td>{t('common.rs')} {f.pricePerUnit}</td>
                        <td>{f.weightPerBag ? `${f.weightPerBag} ${t('common.kg')}` : '-'}</td>
                        <td><button className="btn btn-ghost btn-icon" onClick={() => deleteFertiliser(f.id)}><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ borderColor: '#dc2626' }}>
          <div className="card-header" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
            <h2 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> Danger Zone / අනතුරු කලාපය
            </h2>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--gray-800)', marginBottom: '4px' }}>
                  Clear All Data / සියලුම දත්ත මකන්න
                </p>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                  This will permanently delete ALL data. An OTP will be sent for verification.
                </p>
              </div>
              <button className="btn btn-danger" onClick={handleClearDataClick} style={{ flexShrink: 0 }}>
                <Trash2 size={18} /> Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fertiliser Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('settings.addFertiliser')}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={addFertiliser}>{t('common.save')}</button></>}>
        <div className="form-group">
          <label className="form-label">{t('settings.fertiliserName')} *</label>
          <input className="form-input" value={fertForm.name} onChange={(e) => setFertForm({ ...fertForm, name: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('settings.pricePerUnit')} *</label>
            <input type="number" step="0.01" className="form-input" value={fertForm.pricePerUnit} onChange={(e) => setFertForm({ ...fertForm, pricePerUnit: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.weightPerBag')}</label>
            <input type="number" step="0.1" className="form-input" value={fertForm.weightPerBag} onChange={(e) => setFertForm({ ...fertForm, weightPerBag: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Confirm Clear Data Modal */}
      <Modal isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="⚠️ Confirm Data Clear"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setShowClearConfirm(false)}>Cancel / අවලංගු</button>
          <button className="btn btn-danger" onClick={handleSendOtp} disabled={sendingOtp}>
            {sendingOtp ? <><Loader2 size={16} className="spin" /> Sending OTP...</> : <><ShieldAlert size={16} /> Send OTP & Proceed</>}
          </button>
        </>}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#fef2f2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <AlertTriangle size={36} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '12px' }}>
            Are you absolutely sure?
          </h3>
          <p style={{ color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: '8px' }}>
            This action will <strong>permanently delete ALL data</strong> including:
          </p>
          <div style={{
            background: '#fef2f2', borderRadius: '10px', padding: '14px',
            textAlign: 'left', fontSize: '13px', color: '#991b1b', lineHeight: 1.8
          }}>
            ✕ All Customers / සියලුම ගනුදෙනුකරුවන්<br/>
            ✕ All Tea Collections / සියලුම තේ එකතු කිරීම්<br/>
            ✕ All Credit Purchases / සියලුම ණය මිලදී ගැනීම්<br/>
            ✕ All Monthly Payments / සියලුම මාසික ගෙවීම්<br/>
            ✕ All Driver Commissions / සියලුම රියදුරු කොමිස්<br/>
            ✕ All Lorries & Drivers / සියලුම ලොරි සහ රියදුරන්
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '12px', marginTop: '12px' }}>
            An OTP will be sent to +94 70 211 1487 for verification.
          </p>
        </div>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal isOpen={showOtpModal} onClose={() => { setShowOtpModal(false); setOtpCode(''); }} title="🔐 Enter OTP Code"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setShowOtpModal(false); setOtpCode(''); }}>Cancel / අවලංගු</button>
          <button className="btn btn-danger" onClick={handleVerifyAndClear} disabled={verifying || otpCode.length !== 6}>
            {verifying ? <><Loader2 size={16} className="spin" /> Verifying...</> : <><ShieldAlert size={16} /> Verify & Clear All Data</>}
          </button>
        </>}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: '#f0fdf4', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px'
          }}>
            <ShieldAlert size={36} color="#15803d" />
          </div>
          <p style={{ color: 'var(--gray-600)', marginBottom: '20px', lineHeight: 1.5 }}>
            A 6-digit OTP has been sent to the registered mobile number.<br/>
            <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
              ලියාපදිංචි දුරකථන අංකයට OTP එවා ඇත.
            </span>
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
            {[0, 1, 2, 3, 4, 5].map(idx => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpCode[idx] || ''}
                style={{
                  width: '48px', height: '56px', textAlign: 'center',
                  fontSize: '24px', fontWeight: 700, borderRadius: '10px',
                  border: `2px solid ${otpCode[idx] ? 'var(--primary-500)' : 'var(--gray-300)'}`,
                  outline: 'none', transition: 'all 0.15s ease',
                  color: 'var(--gray-800)'
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val) {
                    const newCode = otpCode.split('');
                    newCode[idx] = val;
                    setOtpCode(newCode.join(''));
                    const next = e.target.nextElementSibling as HTMLInputElement;
                    if (next && idx < 5) next.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otpCode[idx]) {
                    const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement;
                    if (prev) prev.focus();
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                  setOtpCode(pasted);
                }}
              />
            ))}
          </div>

          <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
            OTP expires in 5 minutes / OTP මිනිත්තු 5කින් කල් ඉකුත් වේ
          </p>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSendOtp}
            disabled={sendingOtp}
            style={{ marginTop: '8px' }}
          >
            {sendingOtp ? 'Sending...' : 'Resend OTP / OTP නැවත යවන්න'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
