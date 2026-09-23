'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Plus, ShoppingCart, Printer, X, PlusCircle, Search } from 'lucide-react';
import Modal from '@/components/Modal';
import Toast, { useToast } from '@/components/Toast';
import { printReceipt } from '@/lib/printReceipt';
import CustomerSearch from '@/components/CustomerSearch';

interface FertiliserItem {
  fertiliserId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
}

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { toast, showToast, hideToast } = useToast();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [fertilisers, setFertilisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerId: '', itemType: 'grocery', fertiliserId: '', description: '',
    quantity: '1', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0],
  });

  // Multi-fertiliser items list
  const [fertItems, setFertItems] = useState<FertiliserItem[]>([]);
  const [fertForm, setFertForm] = useState({ fertiliserId: '', quantity: '1' });

  useEffect(() => {
    Promise.all([
      fetch('/api/purchases').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/fertilisers').then(r => r.json()),
    ]).then(([purs, custs, ferts]) => {
      setPurchases(purs);
      setCustomers(custs);
      setFertilisers(ferts);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Only regular customers can make credit purchases
  const regularCustomers = customers.filter((c: any) => c.type === 'regular');

  const totalCost = form.itemType === 'grocery'
    ? parseFloat(form.unitPrice || '0')
    : parseFloat(form.quantity || '0') * parseFloat(form.unitPrice || '0');

  const fertGrandTotal = fertItems.reduce((sum, item) => sum + item.totalCost, 0);

  // Add fertiliser item to the list
  const handleAddFertItem = () => {
    if (!fertForm.fertiliserId) return;
    const fert = fertilisers.find(f => f.id === parseInt(fertForm.fertiliserId));
    if (!fert) return;
    const qty = parseFloat(fertForm.quantity) || 1;
    const newItem: FertiliserItem = {
      fertiliserId: fert.id,
      name: fert.name,
      quantity: qty,
      unitPrice: fert.pricePerUnit,
      totalCost: qty * fert.pricePerUnit,
    };
    setFertItems(prev => [...prev, newItem]);
    setFertForm({ fertiliserId: '', quantity: '1' });
  };

  // Remove fertiliser item from list
  const handleRemoveFertItem = (index: number) => {
    setFertItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdd = async () => {
    try {
      if (form.itemType === 'fertiliser') {
        // Batch add all fertiliser items
        if (fertItems.length === 0) {
          showToast('Please add at least one fertiliser item', 'error');
          return;
        }
        const res = await fetch('/api/purchases/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: parseInt(form.customerId),
            itemType: 'fertiliser',
            purchaseDate: form.purchaseDate,
            items: fertItems.map(item => ({
              fertiliserId: item.fertiliserId,
              description: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalCost: item.totalCost,
            })),
          }),
        });
        if (res.ok) {
          showToast(t('purchases.addSuccess'), 'success');
          setShowModal(false);
          setPurchases(await fetch('/api/purchases').then(r => r.json()));
          resetForm();
        } else {
          showToast(t('common.error'), 'error');
        }
      } else {
        // Single item add (grocery, credit_purchase, cash_advance)
        const qty = form.itemType === 'grocery' ? 1 : parseFloat(form.quantity);
        const price = parseFloat(form.unitPrice);
        const computedTotal = form.itemType === 'grocery' ? price : qty * price;

        const res = await fetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: parseInt(form.customerId),
            itemType: form.itemType,
            fertiliserId: null,
            description: form.description,
            quantity: qty,
            unitPrice: price,
            totalCost: computedTotal,
            purchaseDate: form.purchaseDate,
          }),
        });
        if (res.ok) {
          showToast(t('purchases.addSuccess'), 'success');
          setShowModal(false);
          setPurchases(await fetch('/api/purchases').then(r => r.json()));
          resetForm();
        } else {
          showToast(t('common.error'), 'error');
        }
      }
    } catch (e) { showToast(t('common.error'), 'error'); }
  };

  const resetForm = () => {
    setForm({ customerId: '', itemType: 'grocery', fertiliserId: '', description: '', quantity: '1', unitPrice: '', purchaseDate: new Date().toISOString().split('T')[0] });
    setFertItems([]);
    setFertForm({ fertiliserId: '', quantity: '1' });
  };

  const handlePrint = (p: any) => {
    printReceipt({
      type: 'credit',
      receiptNo: `CRD-${p.id}`,
      date: new Date(p.purchaseDate).toLocaleDateString(),
      customerName: p.customer?.name,
      itemType: p.itemType,
      description: p.description || p.fertiliser?.name || '-',
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      totalCost: p.totalCost,
    });
  };

  const getItemTypeBadge = (itemType: string) => {
    switch (itemType) {
      case 'grocery': return 'badge-blue';
      case 'fertiliser': return 'badge-amber';
      case 'cash_advance': return 'badge-green';
      case 'credit_purchase': return 'badge-purple';
      default: return 'badge-gray';
    }
  };

  const getItemTypeLabel = (itemType: string) => {
    switch (itemType) {
      case 'grocery': return t('purchases.grocery');
      case 'fertiliser': return t('purchases.fertiliser');
      case 'cash_advance': return t('purchases.cashAdvance');
      case 'credit_purchase': return t('purchases.creditPurchase');
      default: return itemType;
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;

  const filteredPurchases = search.trim()
    ? purchases.filter(p => {
        const q = search.toLowerCase();
        const cName = p.customer?.name?.toLowerCase() || '';
        const cId = p.customer?.customerId?.toLowerCase() || '';
        const type = getItemTypeLabel(p.itemType).toLowerCase();
        return cName.includes(q) || cId.includes(q) || type.includes(q);
      })
    : purchases;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      <div className="page-header">
        <h1>{t('purchases.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> {t('purchases.addPurchase')}
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div className="search-bar">
          <Search />
          <input
            type="text"
            className="form-input"
            placeholder="Search purchases by customer or item type..."
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
              <th>{t('common.date')}</th>
              <th>{t('collections.customer')}</th>
              <th>{t('purchases.itemType')}</th>
              <th>{t('purchases.description')}</th>
              <th>{t('purchases.quantity')}</th>
              <th>{t('purchases.unitPrice')}</th>
              <th>{t('purchases.totalCost')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>{t('common.noData')}</td></tr>
            ) : filteredPurchases.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td style={{ fontWeight: 600 }}>
                  {p.customer?.customerId && (
                    <span className="badge badge-blue" style={{ fontFamily: 'monospace', fontSize: '11px', marginRight: '6px' }}>{p.customer.customerId}</span>
                  )}
                  {p.customer?.name}
                </td>
                <td><span className={`badge ${getItemTypeBadge(p.itemType)}`}>{getItemTypeLabel(p.itemType)}</span></td>
                <td>{p.description || '-'}</td>
                <td>{p.quantity}</td>
                <td>{t('common.rs')} {p.unitPrice?.toLocaleString()}</td>
                <td className="amount">{t('common.rs')} {p.totalCost?.toLocaleString()}</td>
                <td><span className={`badge ${p.settled ? 'badge-green' : 'badge-amber'}`}>{p.settled ? t('common.settled') : t('common.pending')}</span></td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handlePrint(p)} title="Print Receipt">
                    <Printer size={14} /> Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={t('purchases.addPurchase')}
        footer={<><button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd}>{t('common.save')}</button></>}>
        <div className="form-group">
          <CustomerSearch
            customers={regularCustomers}
            selectedId={form.customerId}
            onSelect={(id) => setForm({ ...form, customerId: id })}
            label={t('purchases.selectCustomer')}
            required
            placeholder="Search by name or ID..."
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('purchases.itemType')} *</label>
          <select className="form-select" value={form.itemType} onChange={(e) => {
            setForm({ ...form, itemType: e.target.value, fertiliserId: '', description: '', quantity: '1', unitPrice: '' });
            setFertItems([]);
            setFertForm({ fertiliserId: '', quantity: '1' });
          }}>
            <option value="grocery">{t('purchases.grocery')}</option>
            <option value="fertiliser">{t('purchases.fertiliser')}</option>
            <option value="cash_advance">{t('purchases.cashAdvance')}</option>
          </select>
        </div>

        {/* === FERTILISER: Multi-item builder === */}
        {form.itemType === 'fertiliser' && (
          <>
            <div style={{
              background: 'var(--gray-50)', borderRadius: '10px', padding: '16px',
              border: '1px solid var(--gray-200)', marginBottom: '16px',
            }}>
              <div className="form-row" style={{ marginBottom: '8px' }}>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                  <label className="form-label">{t('purchases.selectFertiliser')}</label>
                  <select className="form-select" value={fertForm.fertiliserId}
                    onChange={(e) => setFertForm({ ...fertForm, fertiliserId: e.target.value })}>
                    <option value="">{t('purchases.selectFertiliser')}</option>
                    {fertilisers.map(f => <option key={f.id} value={f.id}>{f.name} - {t('common.rs')} {f.pricePerUnit.toLocaleString()}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">{t('purchases.quantity')}</label>
                  <input type="number" step="1" min="1" className="form-input"
                    value={fertForm.quantity} onChange={(e) => setFertForm({ ...fertForm, quantity: e.target.value })} />
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddFertItem}
                disabled={!fertForm.fertiliserId}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <PlusCircle size={16} /> {t('purchases.addItem')}
              </button>
            </div>

            {fertItems.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>{t('purchases.addedItems')}</label>
                <div style={{
                  border: '1px solid var(--gray-200)', borderRadius: '10px', overflow: 'hidden',
                }}>
                  {fertItems.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderBottom: idx < fertItems.length - 1 ? '1px solid var(--gray-100)' : 'none',
                      background: idx % 2 === 0 ? 'white' : 'var(--gray-50)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                          {item.quantity} × {t('common.rs')} {item.unitPrice.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, marginRight: '12px', color: 'var(--primary-700)' }}>
                        {t('common.rs')} {item.totalCost.toLocaleString()}
                      </div>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => handleRemoveFertItem(idx)}
                        style={{ color: 'var(--error)', borderColor: 'var(--error)', padding: '4px 8px' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '12px 14px',
                    background: 'var(--primary-50)', fontWeight: 700, borderTop: '2px solid var(--primary-200)',
                  }}>
                    <span>{t('purchases.grandTotal')}</span>
                    <span className="amount amount-negative" style={{ fontSize: '18px' }}>
                      {t('common.rs')} {fertGrandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* === GROCERY / CREDIT PURCHASE / CASH ADVANCE: Description field === */}
        {(form.itemType === 'grocery' || form.itemType === 'cash_advance' || form.itemType === 'credit_purchase') && (
          <div className="form-group">
            <label className="form-label">{t('purchases.description')}</label>
            <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={form.itemType === 'cash_advance' ? 'Cash advance reason...' : ''} />
          </div>
        )}

        {/* === Quantity & Price fields (not for fertiliser) === */}
        {form.itemType !== 'fertiliser' && (
          <>
            <div className="form-row">
              {/* Hide quantity for grocery and cash_advance */}
              {form.itemType !== 'grocery' && form.itemType !== 'cash_advance' && (
                <div className="form-group">
                  <label className="form-label">{`${t('purchases.quantity')} *`}</label>
                  <input type="number" step="0.1" className="form-input"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
              )}
              <div className="form-group" style={(form.itemType === 'grocery' || form.itemType === 'cash_advance') ? { flex: 1 } : {}}>
                <label className="form-label">{form.itemType === 'cash_advance' ? 'Cash Advance Amount (Rs.) *' : `${t('purchases.unitPrice')} *`}</label>
                <input type="number" step="0.01" className="form-input" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('purchases.totalCost')}</label>
              <div className="amount amount-negative" style={{ fontSize: '20px', padding: '10px' }}>{t('common.rs')} {totalCost.toLocaleString()}</div>
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label">{t('purchases.purchaseDate')}</label>
          <input type="date" className="form-input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
