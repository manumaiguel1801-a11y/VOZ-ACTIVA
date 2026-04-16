import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { parseMovement, type HistoryEntry } from './gemini.js';

export type { HistoryEntry };

export type MessageSource = 'telegram' | 'whatsapp';
export type SendFn = (text: string) => Promise<void>;

const MSG_HELP_FALLBACK = 'No pude entender el mensaje. Ejemplo: "vendí 3 jugos a 3000".';

/**
 * Processes a financial message from any channel (Telegram, WhatsApp).
 * Parses with Gemini, saves to Firestore, and calls send() with the response.
 *
 * Returns the updated history (user + model entries appended) when history is provided.
 */
export async function processMessage(
  uid: string,
  text: string,
  source: MessageSource,
  send: SendFn,
  db: Firestore,
  history: HistoryEntry[] = [],
): Promise<HistoryEntry[]> {
  const result = await parseMovement(text, history);

  // Build updated history for next turn
  const updatedHistory: HistoryEntry[] = [
    ...history,
    { role: 'user', parts: [{ text }] },
    { role: 'model', parts: [{ text: result.message || MSG_HELP_FALLBACK }] },
  ];

  if (!result.data) {
    await send(result.message || MSG_HELP_FALLBACK);
    return updatedHistory;
  }

  const now = FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);

  // Process secondary movements first (multi-action messages)
  if (result.movements && result.movements.length > 0) {
    for (const mov of result.movements) {
      await saveMovement(userRef, uid, mov, source, now);
    }
  }

  const { type, amount, concept, quantity, unitPrice, debtorName, isPartial, payments } = result.data;

  // Multiple debt payments in one message
  if (payments && payments.length > 0) {
    for (const p of payments) {
      await handleDebtPayment(userRef, uid, p.debtorName, p.amount, p.isPartial, type as 'pago-deuda-debo' | 'cobro-deuda-me-deben', now);
    }
    await send(result.message);
    return updatedHistory;
  }

  // Single debt payment
  if (type === 'pago-deuda-debo' || type === 'cobro-deuda-me-deben') {
    if (debtorName) {
      await handleDebtPayment(userRef, uid, debtorName, amount, isPartial ?? false, type, now);
    } else {
      await send('⚠️ ' + result.message + '\n\nPara pagos de deudas, abre la app directamente.');
      return updatedHistory;
    }
  } else {
    await saveMovement(userRef, uid, result.data, source, now);
  }

  await send(result.message);
  return updatedHistory;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function saveMovement(
  userRef: DocumentReference,
  uid: string,
  data: NonNullable<import('./gemini.js').GeminiResponse['data']>,
  source: MessageSource,
  now: FieldValue,
) {
  const { type, amount, concept, quantity, unitPrice, debtorName } = data;

  switch (type) {
    case 'venta': {
      const qty = quantity ?? 1;
      const price = unitPrice ?? (qty > 1 ? Math.round(amount / qty) : amount);
      await userRef.collection('sales').add({
        items: [{ product: concept, quantity: qty, unitPrice: price, subtotal: amount }],
        total: amount,
        createdAt: now,
        source,
      });
      break;
    }
    case 'compra':
    case 'gasto':
      await userRef.collection('expenses').add({
        concept: type === 'compra' ? `Compra: ${concept}` : concept,
        amount,
        createdAt: now,
        source,
      });
      break;
    case 'deuda-me-deben':
    case 'deuda-debo':
      await userRef.collection('debts').add({
        name: debtorName ?? concept,
        concept,
        amount,
        type: type === 'deuda-me-deben' ? 'me-deben' : 'debo',
        status: 'pendiente',
        createdAt: now,
        source,
      });
      break;
    default:
      console.warn(`[processMessage] Unhandled movement type: ${type} (uid: ${uid})`);
  }
}

export async function handleDebtPayment(
  userRef: DocumentReference,
  uid: string,
  debtorName: string,
  amount: number,
  isPartial: boolean,
  type: 'pago-deuda-debo' | 'cobro-deuda-me-deben',
  now: FieldValue,
) {
  const debtType = type === 'pago-deuda-debo' ? 'debo' : 'me-deben';
  const debtsSnap = await userRef.collection('debts')
    .where('type', '==', debtType)
    .where('status', 'in', ['pendiente', 'parcial'])
    .get();

  const nameLower = debtorName.toLowerCase();
  const matchDoc = debtsSnap.docs.find((d) => {
    const name = (d.data().name as string ?? '').toLowerCase();
    return name.includes(nameLower) || nameLower.includes(name);
  });

  if (!matchDoc) {
    console.warn(`[handleDebtPayment] No debt found for "${debtorName}" (uid: ${uid})`);
    return;
  }

  const debtData = matchDoc.data();
  const prevPaid = (debtData.amountPaid as number | undefined) ?? 0;
  const effectivePay = amount > 0 ? amount : ((debtData.amount as number) - prevPaid);
  const totalPaid = prevPaid + effectivePay;
  const isPaidOff = !isPartial && totalPaid >= (debtData.amount as number);

  await matchDoc.ref.update({
    amountPaid: totalPaid,
    status: isPaidOff ? 'pagada' : 'parcial',
    ...(isPaidOff ? { paidAt: now } : {}),
  });
}
