/**
 * SMS utility for sending notifications via TextLK API.
 * Used to notify customers about tea collections, credit purchases, cash advances, and monthly payments.
 */

const SMS_API_URL = 'https://app.text.lk/api/v3/sms/send';
const SENDER_ID = 'TextLKDemo';

/**
 * Send an SMS message to a phone number.
 * Fails silently — logs errors but never blocks the main operation.
 */
export async function sendSms(phone: string, message: string): Promise<boolean> {
  if (!phone) {
    console.log('[SMS] No phone number provided, skipping SMS');
    return false;
  }

  const apiToken = process.env.TEXTLK_API_TOKEN?.trim();
  if (!apiToken) {
    console.log('[SMS] No API token configured, skipping SMS');
    return false;
  }

  // Format phone number: ensure it starts with 94
  let recipient = phone.replace(/\D/g, ''); // Remove non-digits
  if (recipient.startsWith('0')) {
    recipient = '94' + recipient.substring(1);
  } else if (!recipient.startsWith('94')) {
    recipient = '94' + recipient;
  }

  try {
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipient,
        sender_id: SENDER_ID,
        type: 'plain',
        message,
      }),
    });

    const responseBody = await response.text();
    console.log(`[SMS] Sent to ${recipient}: status=${response.status}`);

    if (responseBody.includes('error')) {
      console.error('[SMS] API error:', responseBody);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[SMS] Failed to send:', error);
    return false;
  }
}

/**
 * Send SMS notification for a tea collection.
 */
export async function sendCollectionSms(
  customerName: string,
  phone: string,
  kilos: number,
  waterDeduction: number,
  netKilos: number,
  date: string
): Promise<void> {
  const deductionLine = waterDeduction > 0
    ? `\nWater Ded: -${waterDeduction}kg`
    : '';
  const message =
    `NIPUNA TEA\n` +
    `-----------\n` +
    `Dear ${customerName},\n` +
    `\n` +
    `Tea collected: ${kilos}kg${deductionLine}\n` +
    `Net weight: ${netKilos}kg\n` +
    `Date: ${date}\n` +
    `\n` +
    `Thank you!\n` +
    `Nipuna Traders`;
  await sendSms(phone, message);
}

/**
 * Send SMS notification for a credit purchase (grocery/fertiliser/credit_purchase).
 */
export async function sendCreditPurchaseSms(
  customerName: string,
  phone: string,
  itemType: string,
  description: string,
  amount: number,
  date: string
): Promise<void> {
  let itemLabel = 'Credit Purchase';
  if (itemType === 'fertiliser') itemLabel = 'Fertiliser';
  else if (itemType === 'grocery') itemLabel = 'Grocery';
  else if (itemType === 'credit_purchase') itemLabel = 'Credit Purchase';

  const descLine = description ? `\nItems: ${description}` : '';
  const message =
    `NIPUNA TEA\n` +
    `-----------\n` +
    `Dear ${customerName},\n` +
    `\n` +
    `${itemLabel} recorded\n` +
    `Amount: Rs.${amount.toLocaleString()}${descLine}\n` +
    `Date: ${date}\n` +
    `\n` +
    `This will be deducted from your monthly payment.\n` +
    `Nipuna Traders`;
  await sendSms(phone, message);
}

/**
 * Send SMS notification for a cash advance.
 */
export async function sendCashAdvanceSms(
  customerName: string,
  phone: string,
  amount: number,
  date: string
): Promise<void> {
  const message =
    `NIPUNA TEA\n` +
    `-----------\n` +
    `Dear ${customerName},\n` +
    `\n` +
    `Cash Advance given\n` +
    `Amount: Rs.${amount.toLocaleString()}\n` +
    `Date: ${date}\n` +
    `\n` +
    `This will be deducted from your monthly payment.\n` +
    `Nipuna Traders`;
  await sendSms(phone, message);
}

/**
 * Send SMS notification for a monthly payment.
 */
export async function sendMonthlyPaymentSms(
  customerName: string,
  phone: string,
  month: string,
  year: number,
  totalKilos: number,
  pricePerKilo: number,
  grossPayment: number,
  groceryDeduction: number,
  fertiliserDeduction: number,
  otherDeductionAmt: number,
  netPayment: number
): Promise<void> {
  let deductions = '';
  if (groceryDeduction > 0) {
    deductions += `\nGrocery: -Rs.${groceryDeduction.toLocaleString()}`;
  }
  if (fertiliserDeduction > 0) {
    deductions += `\nFertiliser: -Rs.${fertiliserDeduction.toLocaleString()}`;
  }
  if (otherDeductionAmt > 0) {
    deductions += `\nOther: -Rs.${Math.round(otherDeductionAmt).toLocaleString()}`;
  }

  const message =
    `NIPUNA TEA\n` +
    `-----------\n` +
    `Dear ${customerName},\n` +
    `\n` +
    `Monthly Payment - ${month} ${year}\n` +
    `\n` +
    `Tea: ${totalKilos.toLocaleString()}kg x Rs.${pricePerKilo}\n` +
    `Gross: Rs.${grossPayment.toLocaleString()}${deductions}\n` +
    `-----------\n` +
    `NET PAY: Rs.${netPayment.toLocaleString()}\n` +
    `\n` +
    `Thank you!\n` +
    `Nipuna Traders`;
  await sendSms(phone, message);
}
