import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { processMessage, type HistoryEntry, type PendingState } from './_lib/processMessage.js';
import { sendWhatsApp, MSG_NOT_LINKED, MSG_HELP } from './_lib/whatsapp-bot.js';

// ─── Firebase Admin init ──────────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) return initializeApp({ credential: cert(JSON.parse(raw)) });
  return initializeApp();
}

const DB_ID = process.env.FIRESTORE_DATABASE_ID ?? 'ai-studio-c7314b5a-dae1-4e68-9a55-87d3b4cfde3e';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
const MAX_HISTORY = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseUserPrice(text: string): number | null {
  const s = text.toLowerCase().replace(/\./g, '').replace(',', '.');
  const milMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:mil\b|k\b)/);
  if (milMatch) return Math.round(parseFloat(milMatch[1]) * 1000);
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return Math.round(parseFloat(numMatch[1]));
  return null;
}

function isAfirmativo(text: string): boolean {
  return /^(si\b|sí\b|yes\b|claro|dale|obvio|afirmativo|simon\b|simón\b|aja\b|ajá\b|ok\b|okey|sip\b|seguro|por supuesto|obvio)/i.test(text.trim());
}

function isNegativo(text: string): boolean {
  return /^(no\b|nel\b|nope|negativo|pa mi\b|para mi\b|uso personal|consumo|no lo vendo|no vendo|mi familia)/i.test(text.trim().toLowerCase());
}

// ─── Multi-turn pending state handler ─────────────────────────────────────────

async function handlePendingState(
  db: ReturnType<typeof getFirestore>,
  userId: string,
  pendingState: PendingState,
  from: string,
  text: string,
): Promise<PendingState | null> {
  const send = (t: string) => sendWhatsApp(from, t);
  const userRef = db.collection('users').doc(userId);
  const lower = text.trim().toLowerCase();

  // Universal cancel
  if (/^(cancelar|cancel|salir|olvida|no importa)$/i.test(lower)) {
    await send('Ok, cancelado.');
    return null;
  }

  // ── Compra nueva — asking-precio-compra ────────────────────────────────────
  if (pendingState.type === 'compra-nueva' && pendingState.step === 'asking-precio-compra') {
    const price = parseUserPrice(text);
    if (!price || price <= 0) {
      await send('No entendí el precio. Dímelo en pesos, ej: *45000* o *45 mil*.');
      return pendingState;
    }
    const { concept, quantity } = pendingState;
    const total = quantity * price;
    await userRef.collection('expenses').add({
      concept: `Compra: ${concept}`,
      amount: total,
      createdAt: FieldValue.serverTimestamp(),
      source: 'whatsapp',
    });
    const next: PendingState = { ...pendingState, precioCompra: price, step: 'asking-si-vende' };
    await send(`$${price.toLocaleString('es-CO')} anotado — gasto de $${total.toLocaleString('es-CO')} registrado.\n¿Los vas a vender?`);
    return next;
  }

  // ── Compra nueva — asking-si-vende ─────────────────────────────────────────
  if (pendingState.type === 'compra-nueva' && pendingState.step === 'asking-si-vende') {
    if (isAfirmativo(lower)) {
      await send(`¿A qué precio vendes ${pendingState.concept}?`);
      return { ...pendingState, step: 'asking-precio-venta' };
    }
    if (isNegativo(lower)) {
      await send('Entendido. Quedó registrado solo como gasto. 👍');
      return null;
    }
    await send(`No entendí. ¿Vas a vender *${pendingState.concept}*? Responde *sí* o *no*.`);
    return pendingState;
  }

  // ── Compra nueva — asking-precio-venta ─────────────────────────────────────
  if (pendingState.type === 'compra-nueva' && pendingState.step === 'asking-precio-venta') {
    const price = parseUserPrice(text);
    if (!price || price <= 0) {
      await send('No entendí el precio de venta. Ej: *80000* o *80 mil*.');
      return pendingState;
    }
    const { concept, quantity, precioCompra = 0 } = pendingState;
    await userRef.collection('inventario').add({
      nombre: concept,
      cantidad: quantity,
      precioCompra,
      precioVenta: price,
      createdAt: FieldValue.serverTimestamp(),
    });
    await send(
      `✅ *${concept}* guardado en inventario.\n` +
      `• Stock: ${quantity} uds.\n` +
      `• Precio compra: $${precioCompra.toLocaleString('es-CO')}\n` +
      `• Precio venta: $${price.toLocaleString('es-CO')}`
    );
    return null;
  }

  // ── Compra existente — asking-precio-compra ────────────────────────────────
  if (pendingState.type === 'compra-existente' && pendingState.step === 'asking-precio-compra') {
    const price = parseUserPrice(text);
    if (!price || price <= 0) {
      await send('No entendí el precio. Ej: *45000* o *45 mil*.');
      return pendingState;
    }
    const { concept, quantity } = pendingState;
    const total = quantity * price;
    await userRef.collection('expenses').add({
      concept: `Compra: ${concept}`,
      amount: total,
      createdAt: FieldValue.serverTimestamp(),
      source: 'whatsapp',
    });
    await send(`✅ Gasto de $${total.toLocaleString('es-CO')} por ${quantity} ${concept} registrado.`);
    return null;
  }

  // ── Venta nueva — asking-precio-venta ─────────────────────────────────────
  if (pendingState.type === 'venta-nueva' && pendingState.step === 'asking-precio-venta') {
    const price = parseUserPrice(text);
    if (!price || price <= 0) {
      await send('No entendí el precio. Ej: *10000* o *10 mil*.');
      return pendingState;
    }
    const { concept, quantity } = pendingState;
    const total = quantity * price;
    await userRef.collection('sales').add({
      items: [{ product: concept, quantity, unitPrice: price, subtotal: total }],
      total,
      createdAt: FieldValue.serverTimestamp(),
      source: 'whatsapp',
    });
    await send(`✅ ${quantity} *${concept}* a $${price.toLocaleString('es-CO')} c/u — Total: $${total.toLocaleString('es-CO')} registrado.`);
    return null;
  }

  // Fallback
  await send('Algo salió mal. Por favor repite tu mensaje desde el principio.');
  return null;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'] as string | undefined;
    const token     = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      console.warn('[whatsapp] Verify failed — mode:', mode, 'token match:', token === VERIFY_TOKEN);
      res.status(403).end();
    }
    return;
  }

  if (req.method !== 'POST') { res.status(405).end(); return; }

  const db = getFirestore(getAdminApp(), DB_ID);
  const body = req.body as WhatsAppWebhookBody;

  if (body?.object !== 'whatsapp_business_account') { res.status(200).end(); return; }

  const value = body.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages?.length) { res.status(200).end(); return; }

  const msg = value.messages[0];
  if (msg.type !== 'text' || !msg.text?.body) { res.status(200).end(); return; }

  const from = msg.from;
  const text = msg.text.body.trim();

  try {
    if (/^(\/ayuda|\/help|ayuda)$/i.test(text)) {
      await sendWhatsApp(from, MSG_HELP);
      return;
    }

    const vinculaMatch = text.match(/^\/?vincular\s+(\S+)/i);
    if (vinculaMatch) {
      await handleLinking(db, from, vinculaMatch[1].trim());
      return;
    }

    const snap = await db.collection('users')
      .where('whatsappPhone', '==', from)
      .limit(1)
      .get();

    if (snap.empty) {
      await sendWhatsApp(from, MSG_NOT_LINKED);
      return;
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    const history: HistoryEntry[] = (userData.whatsappHistory as HistoryEntry[] | undefined) ?? [];
    const pendingState = (userData.whatsappPendingState as PendingState | undefined) ?? null;

    if (pendingState) {
      // Multi-turn flow in progress
      const newPending = await handlePendingState(db, userDoc.id, pendingState, from, text);
      await userDoc.ref.update({
        whatsappPendingState: newPending ?? FieldValue.delete(),
      });
    } else {
      // Normal Gemini processing
      const result = await processMessage(userDoc.id, text, 'whatsapp', (t) => sendWhatsApp(from, t), db, history);
      const trimmed = result.updatedHistory.slice(-MAX_HISTORY);
      await userDoc.ref.update({
        whatsappHistory: trimmed,
        ...(result.pendingState
          ? { whatsappPendingState: result.pendingState }
          : { whatsappPendingState: FieldValue.delete() }),
      });
    }

  } catch (err) {
    console.error('[whatsapp] Error:', err);
    try { await sendWhatsApp(from, '⚠️ Hubo un error. Intenta de nuevo.'); } catch (_) { /* ignore */ }
  } finally {
    res.status(200).end();
  }
}

// ─── Linking ──────────────────────────────────────────────────────────────────
async function handleLinking(db: ReturnType<typeof getFirestore>, from: string, code: string) {
  const snap = await db.collection('users')
    .where('linkCode.code', '==', code)
    .limit(1)
    .get();

  if (snap.empty) {
    await sendWhatsApp(from, '❌ Código inválido.\n\nGenera uno nuevo en *Perfil → Vincular con WhatsApp*.');
    return;
  }

  const userDoc = snap.docs[0];
  const data = userDoc.data();
  const expiresAt: Timestamp | Date = data.linkCode?.expiresAt;
  const expiresMs = expiresAt instanceof Timestamp ? expiresAt.toMillis() : (expiresAt as Date).getTime();

  if (Date.now() > expiresMs) {
    await sendWhatsApp(from, '❌ El código expiró (válido 10 min).\n\nGenera uno nuevo desde la app.');
    return;
  }

  await userDoc.ref.update({ whatsappPhone: from, linkCode: FieldValue.delete() });

  const firstName = (data.firstName as string | undefined) ?? 'amigo';
  await sendWhatsApp(from, `✅ *¡Listo, ${firstName}!* Tu cuenta está vinculada.\n\n${MSG_HELP}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{ from: string; type: string; text?: { body: string } }>;
        statuses?: Array<unknown>;
      };
    }>;
  }>;
}
