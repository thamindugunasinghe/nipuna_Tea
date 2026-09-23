'use client';

import { useEffect, useState } from 'react';
import { Banknote, CheckCircle, Search, History, Printer, Loader2 } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { printReceipt } from '@/lib/printReceipt';

export default function InstantCashPage() {
  const { toast, showToast, hideToast } = useToast();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [collections, setCollections] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Payment Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<any>(null);
  const [pricePerKilo, setPricePerKilo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGlobalPrice();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchCollections();
    } else {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchGlobalPrice = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        const price = settings.find((s: any) => s.key === 'PRICE_PER_KILO')?.value || '';
        setPricePerKilo(price);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instant-cash');
      if (res.ok) setCollections(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/instant-cash/history');
      if (res.ok) setHistory(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handlePayClick = (collection: any) => {
    setSelectedCollection(collection);
    setShowModal(true);
  };

  const handlePrint = (collection: any, price: string) => {
    printReceipt({
      type: 'instant-cash',
      receiptNo: `CASH-${collection.id}`,
      date: new Date(collection.collectionDate).toLocaleDateString(),
      customerName: collection.customer?.name,
      totalKilos: collection.netKilos,
      pricePerKilo: parseFloat(price || '0'),
      netPayment: collection.netKilos * (parseFloat(price || '0')),
    });
  };

  const handleProcessPayment = async () => {
    if (!selectedCollection || !pricePerKilo || parseFloat(pricePerKilo) <= 0) {
      showToast('Please enter a valid price per kilo', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/instant-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedCollection.id }),
      });

      if (res.ok) {
        showToast('Payment processed successfully!', 'success');
        setShowModal(false);
        handlePrint(selectedCollection, pricePerKilo);
        fetchCollections();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to process payment', 'error');
      }
    } catch (e) {
      showToast('An error occurred', 'error');
    }
    setSubmitting(false);
  };

  const currentList = activeTab === 'pending' ? collections : history;
  const filteredList = search.trim()
    ? currentList.filter((c) => {
        const q = search.toLowerCase();
        return c.customer?.name?.toLowerCase().includes(q) || c.customer?.customerId?.toLowerCase().includes(q);
      })
    : currentList;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1><Banknote size={28} style={{ marginRight: '8px', verticalAlign: 'middle', color: 'var(--primary-600)' }} /> Instant Cash Payments (Non-Regular)</h1>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--gray-200)' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '12px 24px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
            background: 'none', color: activeTab === 'pending' ? 'var(--primary-700)' : 'var(--gray-500)',
            borderBottom: activeTab === 'pending' ? '2px solid var(--primary-600)' : '2px solid transparent',
            marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <Banknote size={16} /> Pending Payments
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 24px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
            background: 'none', color: activeTab === 'history' ? 'var(--primary-700)' : 'var(--gray-500)',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary-600)' : '2px solid transparent',
            marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <History size={16} /> History
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <Search />
          <input
            type="text"
            className="form-input"
            placeholder="Search by customer name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Collection Date</th>
              <th>Customer</th>
              <th>Gross Kilos</th>
              <th>Water Deduction</th>
              <th>Net Kilos</th>
              {activeTab === 'history' && <th>Paid Date</th>}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : filteredList.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>No records found.</td></tr>
            ) : filteredList.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>{new Date(c.collectionDate).toLocaleDateString()}</td>
                <td style={{ fontWeight: 600 }}>
                  <span className="badge badge-amber" style={{ fontSize: '10px', marginRight: '6px' }}>Non-Regular</span>
                  {c.customer?.name}
                </td>
                <td>{c.kilosByDriver} kg</td>
                <td style={{ color: '#dc2626' }}>{c.waterDeduction > 0 ? `- ${c.waterDeduction} kg` : '-'}</td>
                <td style={{ fontWeight: 600, color: 'var(--primary-700)' }}>{c.netKilos} kg</td>
                {activeTab === 'history' && (
                  <td>{c.instantPaidAt ? new Date(c.instantPaidAt).toLocaleDateString() : '-'}</td>
                )}
                <td>
                  <span className={`badge ${activeTab === 'pending' ? 'badge-amber' : 'badge-green'}`}>
                    {activeTab === 'pending' ? 'Pending' : 'Paid'}
                  </span>
                </td>
                <td>
                  {activeTab === 'pending' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => handlePayClick(c)}>
                      <Banknote size={14} /> Pay Cash
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>
                        <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        Completed
                      </span>
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(c, pricePerKilo || '0')}>
                        <Printer size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Process Instant Cash Payment">
        {selectedCollection && (
          <div>
            <div style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--gray-500)' }}>Customer:</span>
                <strong style={{ fontSize: '16px' }}>{selectedCollection.customer?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--gray-500)' }}>Net Kilos:</span>
                <strong style={{ fontSize: '16px', color: 'var(--primary-700)' }}>{selectedCollection.netKilos} kg</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Price per Kilo (Rs.)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={pricePerKilo}
                onChange={(e) => setPricePerKilo(e.target.value)}
              />
              <span className="form-hint">Defaults to the global price per kilo in Settings, but can be changed.</span>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ color: '#16a34a', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Total Amount to Pay</span>
              <span style={{ color: '#15803d', fontSize: '28px', fontWeight: 800 }}>
                Rs. {(selectedCollection.netKilos * (parseFloat(pricePerKilo) || 0)).toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleProcessPayment} disabled={submitting || !pricePerKilo}>
                {submitting ? <Loader2 size={16} className="spin" /> : <CheckCircle size={16} />}
                Confirm Payment
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
