import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { processMessage, type HistoryEntry } from './_lib/processMessage.js';
import { sendWhatsApp, MSG_NOT_LINKED, MSG_HELP } from './_lib/whatsapp-bot.js';

// ─── Firebase Admin init ──────────────────────────────────────────────────────
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return initializeApp();
}

const DB_ID = process.env.FIRESTORE_DATABASE_ID ?? 'ai-studio-c7314b5a-dae1-4e68-9a55-87d3b4cfde3e';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
const MAX_HISTORY = 10; // max entries (5 turns) to store per user

// ─── Webhook handler ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — Meta webhook verification
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).end();
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // POST — incoming messages
  const db = getFirestore(getAdminApp(), DB_ID);
  const body = req.body as WhatsAppWebhookBody;

  // Only handle whatsapp_business_account events
  if (body?.object !== 'whatsapp_business_account') {
    res.status(200).end();
    return;
  }

  const value = body.entry?.[0]?.changes?.[0]?.value;

  // Ignore delivery/read receipts (no messages array)
  if (!value?.messages?.length) {
    res.status(200).end();
    return;
  }

  const msg = value.messages[0];

  // Only handle text messages
  if (msg.type !== 'text' || !msg.text?.body) {
    res.status(200).end();
    return;
  }

  const from = msg.from;
  const text = msg.text.body.trim();

  try {
    // Help command
    if (/^(\/ayuda|\/help|ayuda)$/i.test(text)) {
      await sendWhatsApp(from, MSG_HELP);
      return;
    }

    // Linking command: "VINCULAR 123456" or "/vincular 123456"
    const vinculaMatch = text.match(/^\/?vincular\s+(\S+)/i);
    if (vinculaMatch) {
      await handleLinking(db, from, vinculaMatch[1].trim());
      return;
    }

    // Financial message — find user by whatsappPhone
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

    const send = (t: string) => sendWhatsApp(from, t);
    const updatedHistory = await processMessage(userDoc.id, text, 'whatsapp', send, db, history);

    // Persist conversation history (keep last MAX_HISTORY entries)
    const trimmed = updatedHistory.slice(-MAX_HISTORY);
    await userDoc.ref.update({ whatsappHistory: trimmed });

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

  await userDoc.ref.update({
    whatsappPhone: from,
    linkCode: FieldValue.delete(),
  });

  const firstName = (data.firstName as string | undefined) ?? 'amigo';
  await sendWhatsApp(from,
    `✅ *¡Listo, ${firstName}!* Tu cuenta está vinculada.\n\n${MSG_HELP}`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface WhatsAppWebhookBody {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<unknown>;
      };
    }>;
  }>;
}
