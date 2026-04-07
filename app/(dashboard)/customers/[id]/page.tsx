'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then(r => r.json())
      .then(setCustomer)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (!customer) return <div className="empty-state"><h3>{t('common.noData')}</h3></div>;

  const totalCredit = (customer.creditPurchases || [])
    .filter((p: any) => !p.settled)
    .reduce((sum: number, p: any) => sum + p.totalCost, 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/customers" className="btn btn-ghost btn-icon"><ArrowLeft size={18} /></Link>
          <h1>{customer.name}</h1>
          <span className={`badge ${customer.type === 'regular' ? 'badge-green' : 'badge-gray'}`}>
            {customer.type === 'regular' ? t('common.regular') : t('common.nonRegular')}
          </span>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{t('customers.nic')}</h3>
            <div className="stat-value" style={{ fontSize: '18px' }}>{customer.nic || '-'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{t('customers.phone')}</h3>
            <div className="stat-value" style={{ fontSize: '18px' }}>{customer.phone || '-'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{t('customers.creditBalance')}</h3>
            <div className="stat-value amount amount-negative" style={{ fontSize: '20px' }}>{t('common.rs')} {totalCredit.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Credit Purchases */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header"><h2>{t('customers.creditHistory')}</h2></div>
        <div className="card-body">
          {(customer.creditPurchases || []).length === 0 ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>{t('common.noData')}</p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('purchases.itemType')}</th>
                    <th>{t('purchases.description')}</th>
                    <th>{t('purchases.quantity')}</th>
                    <th>{t('purchases.totalCost')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.creditPurchases.map((p: any) => (
                    <tr key={p.id}>
                      <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                      <td><span className={`badge ${p.itemType === 'grocery' ? 'badge-blue' : 'badge-amber'}`}>{t(`purchases.${p.itemType}`)}</span></td>
                      <td>{p.description || '-'}</td>
                      <td>{p.quantity}</td>
                      <td className="amount">{t('common.rs')} {p.totalCost.toLocaleString()}</td>
                      <td><span className={`badge ${p.settled ? 'badge-green' : 'badge-amber'}`}>{p.settled ? t('common.settled') : t('common.pending')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Tea Collections */}
      <div className="card">
        <div className="card-header"><h2>{t('customers.collectionHistory')}</h2></div>
        <div className="card-body">
          {(customer.teaCollections || []).length === 0 ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>{t('common.noData')}</p>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('collections.kilosByDriver')}</th>
                    <th>{t('collections.kilosValidated')}</th>
                    <th>{t('collections.driver')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.teaCollections.map((c: any) => (
                    <tr key={c.id}>
                      <td>{new Date(c.collectionDate).toLocaleDateString()}</td>
                      <td>{c.kilosByDriver} {t('common.kg')}</td>
                      <td>{c.kilosValidated != null ? `${c.kilosValidated} ${t('common.kg')}` : '-'}</td>
                      <td>{c.driver?.name || '-'}</td>
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
