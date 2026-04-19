import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { processMessage } from './_lib/processMessage.js';
import { sendTelegram, MSG_NOT_LINKED, MSG_HELP } from './_lib/telegram-bot.js';

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
const db = getFirestore(getAdminApp(), DB_ID);

// ─── Types ────────────────────────────────────────────────────────────────────
interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const send = (t: string) => sendTelegram(chatId, t);
    await processMessage(snap.docs[0].id, text, 'telegram', send, db);
    // Note: pending state (multi-turn flow) not yet implemented for Telegram
  } catch (err) {
    console.error('[telegram] Error:', err);
    try { await sendTelegram(chatId, '⚠️ Hubo un error. Intenta de nuevo.'); } catch (_) { /* ignore */ }
  } finally {
    res.status(200).end();
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
