'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Leaf, Users, Truck, ShoppingCart, CheckCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';

interface Stats {
  todayCollection: number;
  monthlyCollection: number;
  totalCustomers: number;
  activeDrivers: number;
  recentCollections: any[];
  totalCreditPurchases: number;
  totalCreditCount: number;
  settledCreditAmount: number;
  settledCreditCount: number;
  unsettledCreditAmount: number;
  unsettledCreditCount: number;
  totalPayments: number;
  totalGrossPayments: number;
  paymentCount: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<Stats>({
    todayCollection: 0,
    monthlyCollection: 0,
    totalCustomers: 0,
    activeDrivers: 0,
    recentCollections: [],
    totalCreditPurchases: 0,
    totalCreditCount: 0,
    settledCreditAmount: 0,
    settledCreditCount: 0,
    unsettledCreditAmount: 0,
    unsettledCreditCount: 0,
    totalPayments: 0,
    totalGrossPayments: 0,
    paymentCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  useEffect(() => {
    fetchStats();
  }, [month, year]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-overlay"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>{t('dashboard.title')}</h1>
        {/* Month/Year Selector */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            className="form-select"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            style={{ minWidth: '140px' }}
          >
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="form-select"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={{ minWidth: '100px' }}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><Leaf size={24} /></div>
          <div className="stat-content">
            <h3>Tea Collected / එකතු කළ තේ</h3>
            <div className="stat-value">{stats.monthlyCollection.toLocaleString()}</div>
            <div className="stat-sub">{t('common.kg')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><ShoppingCart size={24} /></div>
          <div className="stat-content">
            <h3>Credit Purchases / ණය මිලදී ගැනීම්</h3>
            <div className="stat-value">{t('common.rs')} {stats.totalCreditPurchases.toLocaleString()}</div>
            <div className="stat-sub">{stats.totalCreditCount} items</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Settled Credit / බේරුම් කළ ණය</h3>
            <div className="stat-value">{t('common.rs')} {stats.settledCreditAmount.toLocaleString()}</div>
            <div className="stat-sub">{stats.settledCreditCount} settled</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>Unsettled Credit / බේරුම් නොකළ ණය</h3>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {t('common.rs')} {stats.unsettledCreditAmount.toLocaleString()}
            </div>
            <div className="stat-sub">{stats.unsettledCreditCount} pending</div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon blue"><DollarSign size={24} /></div>
          <div className="stat-content">
            <h3>Monthly Payments / මාසික ගෙවීම්</h3>
            <div className="stat-value">{t('common.rs')} {stats.totalPayments.toLocaleString()}</div>
            <div className="stat-sub">{stats.paymentCount} customers paid</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Leaf size={24} /></div>
          <div className="stat-content">
            <h3>{t('dashboard.todayCollection')}</h3>
            <div className="stat-value">{stats.todayCollection.toLocaleString()}</div>
            <div className="stat-sub">{t('common.kg')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><Users size={24} /></div>
          <div className="stat-content">
            <h3>{t('dashboard.totalCustomers')}</h3>
            <div className="stat-value">{stats.totalCustomers}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><Truck size={24} /></div>
          <div className="stat-content">
            <h3>{t('dashboard.activeDrivers')}</h3>
            <div className="stat-value">{stats.activeDrivers}</div>
          </div>
        </div>
      </div>

      {/* Recent Collections */}
      <div className="card">
        <div className="card-header">
          <h2>{t('dashboard.recentCollections')} — {months[month - 1]} {year}</h2>
        </div>
        <div className="card-body">
          {stats.recentCollections.length === 0 ? (
            <div className="empty-state">
              <Leaf size={48} />
              <h3>{t('common.noData')}</h3>
              <p>No tea collections for this period.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('collections.customer')}</th>
                    <th>{t('collections.driver')}</th>
                    <th>{t('collections.kilosByDriver')}</th>
                    <th>{t('collections.kilosValidated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentCollections.map((c: any) => (
                    <tr key={c.id}>
                      <td>{new Date(c.collectionDate).toLocaleDateString()}</td>
                      <td>{c.customer?.name}</td>
                      <td>{c.driver?.name || '-'}</td>
                      <td>{c.kilosByDriver} {t('common.kg')}</td>
                      <td>
                        {c.kilosValidated != null
                          ? <span className="badge badge-green">{c.kilosValidated} {t('common.kg')}</span>
                          : <span className="badge badge-amber">{t('collections.notValidated')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
