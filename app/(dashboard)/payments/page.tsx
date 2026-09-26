'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { DollarSign, CheckCircle, Clock, Leaf, ShoppingCart, Search } from 'lucide-react';
import Toast, { useToast } from '@/components/Toast';
import PaymentPopup from '@/components/PaymentPopup';

interface CustomerSummary {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerId_display: string;
  totalKilos: number;
  totalPendingCredit: number;
  pendingCreditCount: number;
  payment: any;
}

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const end = new Date(y, now.getMonth() + 1, 0);
  const d = String(end.getDate()).padStart(2, '0');
  return {
    startDate: `${y}-${m}-01`,
    endDate: `${y}-${m}-${d}`,
  };
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultRange = getMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [startDate, endDate]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?startDate=${startDate}&endDate=${endDate}`, { cache: 'no-store' });
      if (res.ok) setCustomers(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Derive month/year from end date for the MonthlyPayment record
  const paymentMonth = new Date(endDate).getMonth() + 1;
  const paymentYear = new Date(endDate).getFullYear();

  const totalKilos = customers.reduce((s, c) => s + c.totalKilos, 0);
  const totalCredit = customers.reduce((s, c) => s + c.totalPendingCredit, 0);
  const paidCount = customers.filter(c => c.payment?.paid).length;

  // Filter customers by search
  const filtered = search.trim()
    ? customers.filter(c => {
        const q = search.toLowerCase();
        return c.customerName.toLowerCase().includes(q) ||
               (c.customerId_display && c.customerId_display.toLowerCase().includes(q));
      })
    : customers;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('payments.title')}</h1>
      </div>

      {/* Date Range Selector */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body">
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon green"><Leaf size={24} /></div>
          <div className="stat-content">
            <h3>Total Tea Collected</h3>
            <div className="stat-value">{totalKilos.toLocaleString()}</div>
            <div className="stat-sub">kg</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><ShoppingCart size={24} /></div>
          <div className="stat-content">
            <h3>Total Pending Credit</h3>
            <div className="stat-value">Rs. {totalCredit.toLocaleString()}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <h3>Paid Customers</h3>
            <div className="stat-value">{paidCount} / {customers.length}</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <Search />
          <input
            type="text"
            className="form-input"
            placeholder="Search customer by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('collections.customer')}</th>
                <th>{t('payments.totalKilos')}</th>
                <th>Pending Credit</th>
                <th>Credit Items</th>
                <th>{t('common.status')}</th>
                <th>Net Payment</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                    {t('common.noData')}
                    <p style={{ color: 'var(--gray-400)', fontSize: '13px', marginTop: '8px' }}>
                      No customers with tea collections or credit purchases for this period.
                    </p>
                  </td>
                </tr>
              ) : filtered.map((c, i) => (
                <tr
                  key={c.customerId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedCustomer(c)}
                >
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>
                    {c.customerId_display && (
                      <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px', marginRight: '6px' }}>{c.customerId_display}</span>
                    )}
                    {c.customerName}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.totalKilos.toLocaleString()}</span>{' '}
                    <span style={{ color: 'var(--gray-400)', fontSize: '12px' }}>kg</span>
                  </td>
                  <td className="amount-negative">
                    Rs. {c.totalPendingCredit.toLocaleString()}
                  </td>
                  <td>
                    {c.pendingCreditCount > 0 ? (
                      <span className="badge badge-amber">{c.pendingCreditCount} items</span>
                    ) : (
                      <span className="badge badge-green">None</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.payment?.paid ? 'badge-green' : 'badge-amber'}`}>
                      {c.payment?.paid ? (
                        <><CheckCircle size={12} style={{ marginRight: 4 }} /> Paid</>
                      ) : (
                        <><Clock size={12} style={{ marginRight: 4 }} /> Pending</>
                      )}
                    </span>
                  </td>
                  <td>
                    {c.payment?.paid ? (
                      <span className="amount amount-positive" style={{ fontWeight: 700 }}>
                        Rs. {c.payment.netPayment.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--gray-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); }}
                    >
                      <DollarSign size={14} />
                      {c.payment?.paid ? 'View' : 'Pay'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Popup */}
      {selectedCustomer && (
        <PaymentPopup
          customerId={selectedCustomer.customerId}
          customerName={selectedCustomer.customerName}
          month={paymentMonth}
          year={paymentYear}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setSelectedCustomer(null)}
          onPaymentComplete={() => {
            showToast('Payment completed successfully! / ගෙවීම සාර්ථකයි!', 'success');
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
}

