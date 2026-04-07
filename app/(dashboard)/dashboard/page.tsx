'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Leaf, Users, Truck, DollarSign } from 'lucide-react';

interface Stats {
  todayCollection: number;
  monthlyCollection: number;
  totalCustomers: number;
  activeDrivers: number;
  recentCollections: any[];
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    todayCollection: 0,
    monthlyCollection: 0,
    totalCustomers: 0,
    activeDrivers: 0,
    recentCollections: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
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
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green">
            <Leaf size={24} />
          </div>
          <div className="stat-content">
            <h3>{t('dashboard.todayCollection')}</h3>
            <div className="stat-value">{stats.todayCollection.toLocaleString()}</div>
            <div className="stat-sub">{t('common.kg')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Leaf size={24} />
          </div>
          <div className="stat-content">
            <h3>{t('dashboard.monthlyCollection')}</h3>
            <div className="stat-value">{stats.monthlyCollection.toLocaleString()}</div>
            <div className="stat-sub">{t('common.kg')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{t('dashboard.totalCustomers')}</h3>
            <div className="stat-value">{stats.totalCustomers}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Truck size={24} />
          </div>
          <div className="stat-content">
            <h3>{t('dashboard.activeDrivers')}</h3>
            <div className="stat-value">{stats.activeDrivers}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>{t('dashboard.recentCollections')}</h2>
        </div>
        <div className="card-body">
          {stats.recentCollections.length === 0 ? (
            <div className="empty-state">
              <Leaf size={48} />
              <h3>{t('common.noData')}</h3>
              <p>Start adding tea collections to see data here.</p>
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
