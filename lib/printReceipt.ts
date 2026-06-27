'use client';

interface ReceiptData {
  type: 'payment' | 'commission' | 'credit';
  // Common
  receiptNo?: string;
  date: string;
  // Payment
  customerName?: string;
  totalKilos?: number;
  pricePerKilo?: number;
  grossPayment?: number;
  groceryDeduction?: number;
  fertiliserDeduction?: number;
  otherDeduction?: number;
  otherDeductionPct?: number;
  netPayment?: number;
  month?: string;
  year?: number;
  collections?: any[];
  settledCredits?: any[];
  // Commission
  driverName?: string;
  commissionRate?: number;
  commissionAmount?: number;
  // Credit
  itemType?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalCost?: number;
}

export function printReceipt(data: ReceiptData) {
  const printWindow = window.open('', '_blank', 'width=420,height=800');
  if (!printWindow) return;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  let bodyContent = '';

  if (data.type === 'payment') {
    // Build collections table
    let collectionsHtml = '';
    if (data.collections && data.collections.length > 0) {
      collectionsHtml = `
        <div class="section-title">Tea Collections / තේ එකතු කිරීම්</div>
        <table>
          <tr class="table-header">
            <td class="label-cell" style="font-weight:700;font-size:10px">Date</td>
            <td class="label-cell" style="font-weight:700;font-size:10px">Driver</td>
            <td class="value-cell" style="font-weight:700;font-size:10px">Kilos</td>
          </tr>
          ${data.collections.map(c => `
            <tr>
              <td class="label-cell" style="font-size:11px">${new Date(c.collectionDate).toLocaleDateString()}</td>
              <td class="label-cell" style="font-size:11px">${c.driver?.name || '-'}</td>
              <td class="value-cell" style="font-size:11px">${c.kilosValidated ?? c.kilosByDriver} kg</td>
            </tr>
          `).join('')}
        </table>
        <div class="divider dashed"></div>
      `;
    }

    // Build settled credits table
    let creditsHtml = '';
    if (data.settledCredits && data.settledCredits.length > 0) {
      creditsHtml = `
        <div class="section-title">Settled Credits / බේරුම් කළ ණය</div>
        <table>
          <tr class="table-header">
            <td class="label-cell" style="font-weight:700;font-size:10px">Date</td>
            <td class="label-cell" style="font-weight:700;font-size:10px">Item</td>
            <td class="value-cell deduct" style="font-weight:700;font-size:10px">Amount</td>
          </tr>
          ${data.settledCredits.map(c => `
            <tr>
              <td class="label-cell" style="font-size:11px">${new Date(c.purchaseDate).toLocaleDateString()}</td>
              <td class="label-cell" style="font-size:11px">${c.description || c.fertiliser?.name || (c.itemType === 'grocery' ? 'Grocery' : 'Fertiliser')}</td>
              <td class="value-cell deduct" style="font-size:11px">- Rs. ${c.totalCost.toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
        <div class="divider dashed"></div>
      `;
    }

    bodyContent = `
      <div class="receipt-type">Monthly Tea Payment Receipt</div>
      <div class="receipt-type-si">මාසික තේ දෙනුම් කුවිතාන්සිය</div>
      
      <div class="info-row">
        <span class="label">Customer / තේ වෙළෙන්දා:</span>
        <span class="value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="label">Period / කාලය:</span>
        <span class="value">${data.month} ${data.year}</span>
      </div>
      <div class="info-row">
        <span class="label">Date / දිනය:</span>
        <span class="value">${data.date}</span>
      </div>

      <div class="divider"></div>

      ${collectionsHtml}

      <table>
        <tr>
          <td class="label-cell">Total Tea (kg) / මුළු තේ</td>
          <td class="value-cell">${data.totalKilos?.toLocaleString()} kg</td>
        </tr>
        <tr>
          <td class="label-cell">Price per Kilo / කිලෝ මිල</td>
          <td class="value-cell">Rs. ${data.pricePerKilo?.toLocaleString()}</td>
        </tr>
        <tr>
          <td class="label-cell">Gross Payment / දළ ගෙවීම</td>
          <td class="value-cell">Rs. ${data.grossPayment?.toLocaleString()}</td>
        </tr>
      </table>

      <div class="divider dashed"></div>
      <div class="section-title">Deductions / අඩු කිරීම්</div>

      ${creditsHtml}

      <table>
        <tr>
          <td class="label-cell">Grocery / සිල්ලර බඩු</td>
          <td class="value-cell deduct">- Rs. ${data.groceryDeduction?.toLocaleString()}</td>
        </tr>
        <tr>
          <td class="label-cell">Fertiliser / පොහොර</td>
          <td class="value-cell deduct">- Rs. ${data.fertiliserDeduction?.toLocaleString()}</td>
        </tr>
        <tr>
          <td class="label-cell">Other (${data.otherDeductionPct || 5}%) / වෙනත්</td>
          <td class="value-cell deduct">- Rs. ${data.otherDeduction?.toLocaleString()}</td>
        </tr>
      </table>

      <div class="divider thick"></div>

      <div class="total-row">
        <span>Net Payment / ශුද්ධ ගෙවීම</span>
        <span class="total-amount">Rs. ${data.netPayment?.toLocaleString()}</span>
      </div>
    `;
  } else if (data.type === 'commission') {
    bodyContent = `
      <div class="receipt-type">Driver Commission Receipt</div>
      <div class="receipt-type-si">රියදුරු කොමිස් කුවිතාන්සිය</div>
      
      <div class="info-row">
        <span class="label">Driver / රියදුරු:</span>
        <span class="value">${data.driverName}</span>
      </div>
      <div class="info-row">
        <span class="label">Period / කාලය:</span>
        <span class="value">${data.month} ${data.year}</span>
      </div>
      <div class="info-row">
        <span class="label">Date / දිනය:</span>
        <span class="value">${data.date}</span>
      </div>

      <div class="divider"></div>

      <table>
        <tr>
          <td class="label-cell">Total Tea Collected (kg)</td>
          <td class="value-cell">${data.totalKilos?.toLocaleString()} kg</td>
        </tr>
        <tr>
          <td class="label-cell">Price per Kilo / කිලෝ මිල</td>
          <td class="value-cell">Rs. ${data.pricePerKilo?.toLocaleString()}</td>
        </tr>
        <tr>
          <td class="label-cell">Commission Rate / අනුපාතය</td>
          <td class="value-cell">${data.commissionRate}%</td>
        </tr>
      </table>

      <div class="divider thick"></div>

      <div class="total-row">
        <span>Commission / කොමිස් මුදල</span>
        <span class="total-amount">Rs. ${data.commissionAmount?.toLocaleString()}</span>
      </div>
    `;
  } else if (data.type === 'credit') {
    bodyContent = `
      <div class="receipt-type">Credit Purchase Receipt</div>
      <div class="receipt-type-si">ණය මිලදී ගැනීමේ කුවිතාන්සිය</div>
      
      <div class="info-row">
        <span class="label">Customer / තේ වෙළෙන්දා:</span>
        <span class="value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="label">Date / දිනය:</span>
        <span class="value">${data.date}</span>
      </div>
      <div class="info-row">
        <span class="label">Type / වර්ගය:</span>
        <span class="value">${data.itemType === 'grocery' ? 'Grocery / සිල්ලර බඩු' : 'Fertiliser / පොහොර'}</span>
      </div>

      <div class="divider"></div>

      <table>
        <tr>
          <td class="label-cell">Description / විස්තරය</td>
          <td class="value-cell">${data.description || '-'}</td>
        </tr>
        <tr>
          <td class="label-cell">Quantity / ප්‍රමාණය</td>
          <td class="value-cell">${data.quantity}</td>
        </tr>
        <tr>
          <td class="label-cell">Unit Price / ඒකක මිල</td>
          <td class="value-cell">Rs. ${data.unitPrice?.toLocaleString()}</td>
        </tr>
      </table>

      <div class="divider thick"></div>

      <div class="total-row">
        <span>Total / මුළු මුදල</span>
        <span class="total-amount">Rs. ${data.totalCost?.toLocaleString()}</span>
      </div>

      <div class="credit-note">
        This amount will be deducted from the monthly tea payment.<br/>
        මෙම මුදල මාසික තේ ගෙවීමෙන් අඩු කරනු ලැබේ.
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - Nipuna Tea Collectors</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Sinhala:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', 'Noto Sans Sinhala', sans-serif;
      font-size: 13px;
      color: #1f2937;
      background: #fff;
      padding: 0;
    }

    .receipt {
      width: 380px;
      margin: 0 auto;
      padding: 24px 20px;
    }

    /* ===== HEADER ===== */
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 3px solid #15803d;
    }

    .logo {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      margin-bottom: 10px;
      object-fit: cover;
    }

    .company-name {
      font-size: 18px;
      font-weight: 800;
      color: #14532d;
      letter-spacing: 0.5px;
    }

    .company-sub {
      font-size: 10px;
      color: #6b7280;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 2px;
    }

    /* ===== RECEIPT TYPE ===== */
    .receipt-type {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #15803d;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .receipt-type-si {
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 16px;
    }

    /* ===== INFO ROWS ===== */
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 12px;
    }

    .info-row .label {
      color: #6b7280;
      font-weight: 500;
    }

    .info-row .value {
      font-weight: 600;
      color: #1f2937;
      text-align: right;
    }

    /* ===== DIVIDERS ===== */
    .divider {
      border-bottom: 1px solid #e5e7eb;
      margin: 12px 0;
    }

    .divider.dashed {
      border-bottom-style: dashed;
    }

    .divider.thick {
      border-bottom: 2px solid #14532d;
      margin: 14px 0;
    }

    /* ===== TABLE ===== */
    table {
      width: 100%;
      border-collapse: collapse;
    }

    table tr td {
      padding: 6px 0;
      font-size: 12px;
    }

    .table-header td {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }

    .label-cell {
      color: #4b5563;
      font-weight: 500;
    }

    .value-cell {
      text-align: right;
      font-weight: 600;
      color: #1f2937;
    }

    .value-cell.deduct {
      color: #dc2626;
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    /* ===== TOTAL ===== */
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: linear-gradient(135deg, #f0fdf4, #dcfce7);
      border-radius: 10px;
      border: 1px solid #bbf7d0;
    }

    .total-row span:first-child {
      font-size: 13px;
      font-weight: 600;
      color: #14532d;
    }

    .total-amount {
      font-size: 20px;
      font-weight: 800;
      color: #15803d;
    }

    /* ===== CREDIT NOTE ===== */
    .credit-note {
      margin-top: 14px;
      padding: 10px 12px;
      background: #fef3c7;
      border-radius: 8px;
      border: 1px solid #fde68a;
      font-size: 10px;
      color: #92400e;
      text-align: center;
      line-height: 1.5;
    }

    /* ===== FOOTER ===== */
    .footer {
      margin-top: 24px;
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    .footer .thankyou {
      font-size: 13px;
      font-weight: 600;
      color: #15803d;
      margin-bottom: 2px;
    }

    .footer .thankyou-si {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 10px;
    }

    .signature {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      padding: 0 10px;
    }

    .sig-block {
      text-align: center;
      width: 120px;
    }

    .sig-line {
      border-top: 1px solid #9ca3af;
      margin-bottom: 4px;
    }

    .sig-label {
      font-size: 9px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .receipt-no {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 12px;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 60px;
      font-weight: 800;
      color: rgba(22, 163, 74, 0.04);
      pointer-events: none;
      white-space: nowrap;
    }

    @media print {
      body { padding: 0; }
      .receipt { width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="watermark">NIPUNA TEA</div>
  <div class="receipt">
    <div class="header">
      <img src="/logo.jpg" class="logo" alt="Logo" />
      <div class="company-name">NIPUNA TEA COLLECTORS</div>
      <div class="company-sub">Tea Collection & Financial Management</div>
    </div>

    ${bodyContent}

    <div class="footer">
      <div class="thankyou">Thank You!</div>
      <div class="thankyou-si">ස්තුතියි!</div>

      <div class="signature">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Authorized / අත්සන</div>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Received / ලැබුවා</div>
        </div>
      </div>

      <div class="receipt-no">Receipt #${data.receiptNo || Date.now()}</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  <\/script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
