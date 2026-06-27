'use client';

import { useEffect, useState } from 'react';
import { X, Leaf, ShoppingCart, CheckSquare, Square, CheckCircle, Printer, Loader2 } from 'lucide-react';
import { printReceipt } from '@/lib/printReceipt';

interface PaymentPopupProps {
  customerId: number;
  customerName: string;
  month: number;
  year: number;
  onClose: () => void;
  onPaymentComplete: () => void;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PaymentPopup({
  customerId, customerName, month, year, onClose, onPaymentComplete,
}: PaymentPopupProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [pricePerKilo, setPricePerKilo] = useState('');
  const [selectedCreditIds, setSelectedCreditIds] = useState<number[]>([]);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  useEffect(() => {
    fetchDetail();
  }, [customerId, month, year]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/payments/customer-detail?customerId=${customerId}&month=${month}&year=${year}`
      );
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setPricePerKilo(String(d.defaultPricePerKilo || ''));
        // If payment already exists, don't pre-select credits
        if (!d.existingPayment) {
          setSelectedCreditIds([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleCredit = (id: number) => {
    setSelectedCreditIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (data?.pendingCredits) {
      setSelectedCreditIds(data.pendingCredits.map((c: any) => c.id));
    }
  };

  const deselectAll = () => {
    setSelectedCreditIds([]);
  };

  // Calculations
  const price = parseFloat(pricePerKilo || '0');
  const totalKilos = data?.totalValidatedKilos || 0;
  const grossPayment = totalKilos * price;

  const selectedCredits = data?.pendingCredits?.filter((c: any) => selectedCreditIds.includes(c.id)) || [];
  const groceryDeduction = selectedCredits
    .filter((c: any) => c.itemType === 'grocery')
    .reduce((sum: number, c: any) => sum + c.totalCost, 0);
  const fertiliserDeduction = selectedCredits
    .filter((c: any) => c.itemType === 'fertiliser')
    .reduce((sum: number, c: any) => sum + c.totalCost, 0);
  const totalDeductions = groceryDeduction + fertiliserDeduction;

  const otherDeductionRate = data?.otherDeductionRate || 5;
  const otherDeductionAmt = grossPayment * (otherDeductionRate / 100);
  const netPayment = Math.max(0, grossPayment - totalDeductions - otherDeductionAmt);

  const handlePay = async () => {
    if (!price || price <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/payments/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          month,
          year,
          pricePerKilo: price,
          settledCreditIds: selectedCreditIds,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setPaymentResult(result);
        onPaymentComplete();
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handlePrint = () => {
    if (!paymentResult) return;
    const p = paymentResult.payment;
    printReceipt({
      type: 'payment',
      receiptNo: `PAY-${p.id}`,
      date: new Date().toLocaleDateString(),
      customerName: p.customer?.name || customerName,
      totalKilos: p.totalKilos,
      pricePerKilo: p.pricePerKilo,
      grossPayment: p.grossPayment,
      groceryDeduction: p.groceryDeduction,
      fertiliserDeduction: p.fertiliserDeduction,
      otherDeduction: p.otherDeductionAmt,
      netPayment: p.netPayment,
      month: monthNames[month - 1],
      year: year,
      collections: paymentResult.collections,
      settledCredits: paymentResult.settledCredits,
      otherDeductionPct: p.otherDeductionPct,
    });
  };

  const alreadyPaid = data?.existingPayment?.paid;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: '800px', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: 'var(--primary-50)' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary-800)' }}>
              {customerName}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>
              {monthNames[month - 1]} {year} — Monthly Payment
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(92vh - 180px)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" />
            </div>
          ) : paymentResult ? (
            /* ========== PAYMENT SUCCESS VIEW ========== */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'var(--primary-100)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <CheckCircle size={36} color="var(--primary-700)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-800)', marginBottom: '8px' }}>
                Payment Completed!
              </h3>
              <p style={{ color: 'var(--gray-500)', marginBottom: '4px' }}>
                {customerName} — {monthNames[month - 1]} {year}
              </p>
              <div style={{
                fontSize: '32px', fontWeight: 800, color: 'var(--primary-700)',
                margin: '16px 0',
              }}>
                Rs. {paymentResult.payment.netPayment.toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={handlePrint}>
                  <Printer size={18} /> Print Bill
                </button>
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* ========== PAYMENT FORM VIEW ========== */
            <>
              {/* Already paid warning */}
              {alreadyPaid && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px',
                  padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e',
                }}>
                  ⚠️ Payment already recorded for this month. Submitting again will update the existing payment.
                </div>
              )}

              {/* Price per Kilo */}
              <div style={{
                background: 'var(--gray-50)', borderRadius: '10px', padding: '16px',
                marginBottom: '20px', border: '1px solid var(--gray-200)',
              }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: '8px' }}>
                  Price per Kilo (Rs.) / කිලෝ මිල
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={pricePerKilo}
                  onChange={(e) => setPricePerKilo(e.target.value)}
                  style={{ maxWidth: '200px', fontSize: '18px', fontWeight: 700 }}
                />
                {data?.defaultPricePerKilo > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginLeft: '12px' }}>
                    Default: Rs. {data.defaultPricePerKilo}
                  </span>
                )}
              </div>

              {/* Tea Collections Section */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
                }}>
                  <Leaf size={18} color="var(--primary-600)" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)' }}>
                    Tea Collections / තේ එකතු කිරීම්
                  </h3>
                  <span className="badge badge-green" style={{ marginLeft: 'auto' }}>
                    {totalKilos.toLocaleString()} kg
                  </span>
                </div>

                {data?.collections?.length > 0 ? (
                  <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)' }}>
                    <table className="table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Driver</th>
                          <th>Kilos (Driver)</th>
                          <th>Kilos (Validated)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.collections.map((c: any) => (
                          <tr key={c.id}>
                            <td>{new Date(c.collectionDate).toLocaleDateString()}</td>
                            <td>{c.driver?.name || '-'}</td>
                            <td>{c.kilosByDriver} kg</td>
                            <td>
                              {c.kilosValidated != null
                                ? <span className="badge badge-green">{c.kilosValidated} kg</span>
                                : <span className="badge badge-amber">Not validated</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--gray-400)', fontSize: '13px', padding: '12px' }}>
                    No collections for this month.
                  </p>
                )}
              </div>

              {/* Credit Purchases Section */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
                  flexWrap: 'wrap',
                }}>
                  <ShoppingCart size={18} color="#b45309" />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-800)' }}>
                    Credit Purchases / ණය මිලදී ගැනීම්
                  </h3>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={selectAll}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Settle All
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={deselectAll}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {data?.pendingCredits?.length > 0 ? (
                  <div className="table-wrapper" style={{ border: '1px solid var(--gray-200)' }}>
                    <table className="table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Settle</th>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pendingCredits.map((c: any) => (
                          <tr
                            key={c.id}
                            onClick={() => toggleCredit(c.id)}
                            style={{
                              cursor: 'pointer',
                              background: selectedCreditIds.includes(c.id) ? 'var(--primary-50)' : undefined,
                            }}
                          >
                            <td>
                              {selectedCreditIds.includes(c.id)
                                ? <CheckSquare size={18} color="var(--primary-600)" />
                                : <Square size={18} color="var(--gray-400)" />
                              }
                            </td>
                            <td>{new Date(c.purchaseDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge ${c.itemType === 'grocery' ? 'badge-blue' : 'badge-amber'}`}>
                                {c.itemType === 'grocery' ? 'Grocery' : 'Fertiliser'}
                              </span>
                            </td>
                            <td>{c.description || c.fertiliser?.name || '-'}</td>
                            <td className="amount-negative" style={{ fontWeight: 600 }}>
                              Rs. {c.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--gray-400)', fontSize: '13px', padding: '12px' }}>
                    No pending credit purchases.
                  </p>
                )}
              </div>

              {/* ========== SUMMARY ========== */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-50), #ecfdf5)',
                borderRadius: '12px', padding: '20px', border: '1px solid var(--primary-200)',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-800)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Payment Summary / ගෙවීම් සාරාංශය
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Total Tea (kg) / මුළු තේ</span>
                    <span style={{ fontWeight: 600 }}>{totalKilos.toLocaleString()} kg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Price per Kilo / කිලෝ මිල</span>
                    <span style={{ fontWeight: 600 }}>Rs. {price.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Gross Payment / දළ ගෙවීම</span>
                    <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>Rs. {grossPayment.toLocaleString()}</span>
                  </div>

                  <div style={{ borderTop: '1px dashed var(--gray-300)', margin: '4px 0' }} />

                  {groceryDeduction > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#dc2626' }}>Grocery Deduction / සිල්ලර බඩු</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>- Rs. {groceryDeduction.toLocaleString()}</span>
                    </div>
                  )}
                  {fertiliserDeduction > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#dc2626' }}>Fertiliser Deduction / පොහොර</span>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>- Rs. {fertiliserDeduction.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#dc2626' }}>Other ({otherDeductionRate}%) / වෙනත්</span>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>- Rs. {otherDeductionAmt.toLocaleString()}</span>
                  </div>

                  <div style={{ borderTop: '2px solid var(--primary-600)', margin: '6px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-800)' }}>
                      Net Payment / ශුද්ධ ගෙවීම
                    </span>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-700)' }}>
                      Rs. {netPayment.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !paymentResult && (
          <div className="modal-footer" style={{ borderTop: '1px solid var(--gray-200)' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handlePay}
              disabled={submitting || !price || price <= 0 || totalKilos === 0}
              style={{ minWidth: '140px' }}
            >
              {submitting
                ? <><Loader2 size={16} className="spin" /> Processing...</>
                : <><CheckCircle size={18} /> Pay & Generate Bill</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
