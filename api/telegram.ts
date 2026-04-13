import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { parseMovement } from './_lib/gemini.js';
import { sendTelegram, MSG_NOT_LINKED, MSG_HELP } from './_lib/telegram-bot.js';

// ─── Firebase Admin init ──────────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  // Fallback: GOOGLE_APPLICATION_CREDENTIALS env var (for local dev)
  return initializeApp();
}

const DB_ID = process.env.FIRESTORE_DATABASE_ID ?? 'ai-studio-c7314b5a-dae1-4e68-9a55-87d3b4cfde3e';
const db = getFirestore(getAdminApp(), DB_ID);

// ─── Types ────────────────────────────────────────────────────────────────────
interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).end(); // Respond to Telegram immediately to avoid retries

  if (req.method !== 'POST') return;

  const message = (req.body as { message?: TelegramMessage }).message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    if (text === '/start' || text.startsWith('/start ')) {
      await sendTelegram(chatId, MSG_NOT_LINKED);
      return;
    }

    if (text === '/ayuda' || text === '/help') {
      await sendTelegram(chatId, MSG_HELP);
      return;
    }

    if (text.startsWith('/vincular')) {
      const code = text.split(/\s+/)[1]?.trim();
      if (!code) {
        await sendTelegram(chatId, '⚠️ Envía el código así:\n<code>/vincular 123456</code>');
        return;
      }
      await handleLinking(chatId, code);
      return;
    }

    // Regular message — look up linked user
    const snap = await db.collection('users')
      .where('telegramChatId', '==', String(chatId))
      .limit(1)
      .get();

    if (snap.empty) {
      await sendTelegram(chatId, MSG_NOT_LINKED);
      return;
    }

    await processMessage(snap.docs[0].id, chatId, text);
  } catch (err) {
    console.error('[telegram] Error:', err);
    try { await sendTelegram(chatId, '⚠️ Hubo un error. Intenta de nuevo.'); } catch (_) { /* ignore */ }
  }
}

// ─── Linking ──────────────────────────────────────────────────────────────────
async function handleLinking(chatId: number, code: string) {
  const snap = await db.collection('users')
    .where('linkCode.code', '==', code)
    .limit(1)
    .get();

  if (snap.empty) {
    await sendTelegram(chatId, '❌ Código inválido.\n\nGenera uno nuevo en <b>Perfil → Vincular con Telegram</b>.');
    return;
  }

  const userDoc = snap.docs[0];
  const data = userDoc.data();
  const expiresAt: Timestamp | Date = data.linkCode?.expiresAt;
  const expiresMs = expiresAt instanceof Timestamp ? expiresAt.toMillis() : (expiresAt as Date).getTime();

  if (Date.now() > expiresMs) {
    await sendTelegram(chatId, '❌ El código expiró (válido 10 min).\n\nGenera uno nuevo desde la app.');
    return;
  }

  await userDoc.ref.update({
    telegramChatId: String(chatId),
    linkCode: FieldValue.delete(),
  });

  const firstName = (data.firstName as string | undefined) ?? 'amigo';
  await sendTelegram(chatId,
    `✅ <b>¡Listo, ${firstName}!</b> Tu cuenta está vinculada.\n\n${MSG_HELP}`
  );
}

// ─── Message processing ───────────────────────────────────────────────────────
async function processMessage(uid: string, chatId: number, text: string) {
  const result = await parseMovement(text);

  if (!result.data) {
    await sendTelegram(chatId, result.message || MSG_HELP);
    return;
  }

  const { type, amount, concept, quantity, unitPrice, debtorName, isPartial, payments } = result.data;
  const now = FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);

  if (payments && payments.length > 0) {
    for (const p of payments) {
      await handleDebtPayment(userRef, uid, p.debtorName, p.amount, p.isPartial, type as 'pago-deuda-debo' | 'cobro-deuda-me-deben', now);
    }
    await sendTelegram(chatId, result.message);
    return;
  }

  switch (type) {
    case 'venta': {
      const qty = quantity ?? 1;
      const price = unitPrice ?? (qty > 1 ? Math.round(amount / qty) : amount);
      await userRef.collection('sales').add({
        items: [{ product: concept, quantity: qty, unitPrice: price, subtotal: amount }],
        total: amount,
        createdAt: now,
        source: 'telegram',
      });
      break;
    }
    case 'compra':
    case 'gasto':
      await userRef.collection('expenses').add({
        concept: type === 'compra' ? `Compra: ${concept}` : concept,
        amount,
        createdAt: now,
        source: 'telegram',
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
        source: 'telegram',
      });
      break;
    case 'pago-deuda-debo':
    case 'cobro-deuda-me-deben':
      if (debtorName) {
        await handleDebtPayment(userRef, uid, debtorName, amount, isPartial ?? false, type, now);
      } else {
        await sendTelegram(chatId, '⚠️ ' + result.message + '\n\nPara pagos de deudas, abre la app directamente.');
        return;
      }
      break;
  }

  await sendTelegram(chatId, result.message);
}

// ─── Debt payment ─────────────────────────────────────────────────────────────
async function handleDebtPayment(
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
