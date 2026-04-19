import { FieldValue, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { parseMovement, type HistoryEntry } from './gemini.js';

export type { HistoryEntry };
export type MessageSource = 'telegram' | 'whatsapp';
export type SendFn = (text: string) => Promise<void>;

export interface PendingState {
  type: 'compra-nueva' | 'compra-existente' | 'venta-nueva';
  concept: string;
  quantity: number;
  step: 'asking-precio-compra' | 'asking-si-vende' | 'asking-precio-venta';
  precioCompra?: number;
}

export interface ProcessResult {
  updatedHistory: HistoryEntry[];
  pendingState?: PendingState;
}

interface SaveMovementResult {
  newStock?: number;
  isPrecioEspecial?: boolean;
  price?: number;
  storedPrice?: number;
  needsVentaPrice?: boolean;
  isNewCompra?: boolean;
  needsCompraPrice?: boolean;
  concept?: string;
  quantity?: number;
  precioCompra?: number;
}

const MSG_HELP_FALLBACK = 'No pude entender el mensaje. Ejemplo: "vendí 3 jugos a 3000".';

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function findInventoryProduct(userRef: DocumentReference, name: string) {
  const n = normalizeStr(name);
  if (!n) return null;
  const snap = await userRef.collection('inventario').get();
  const products = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...(d.data() as any) }));
  const exact = products.find((p: any) => normalizeStr(p.nombre) === n);
  if (exact) return exact;
  const contains = products.find((p: any) => {
    const pn = normalizeStr(p.nombre);
    return pn.includes(n) || n.includes(pn);
  });
  if (contains) return contains;
  const nWords = n.split(/\s+/).filter((w: string) => w.length > 2);
  return products.find((p: any) => {
    const pWords = normalizeStr(p.nombre).split(/\s+/);
    return nWords.some((nw: string) => pWords.some((pw: string) => pw.includes(nw) || nw.includes(pw)));
  }) ?? null;
}

export async function processMessage(
  uid: string,
  text: string,
  source: MessageSource,
  send: SendFn,
  db: Firestore,
  history: HistoryEntry[] = [],
): Promise<ProcessResult> {
  const result = await parseMovement(text, history);

  const updatedHistory: HistoryEntry[] = [
    ...history,
    { role: 'user', parts: [{ text }] },
    { role: 'model', parts: [{ text: result.message || MSG_HELP_FALLBACK }] },
  ];

  if (!result.data) {
    await send(result.message || MSG_HELP_FALLBACK);
    return { updatedHistory };
  }

  const now = FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);

  // Secondary movements (multi-action messages)
  if (result.movements && result.movements.length > 0) {
    for (const mov of result.movements) {
      await saveMovement(userRef, uid, mov, source, now);
    }
  }

  const { type, amount, concept, quantity, unitPrice, debtorName, isPartial, payments } = result.data;

  // ── Debt payments ──────────────────────────────────────────────────────────
  if (payments && payments.length > 0) {
    const lines: string[] = [];
    for (const p of payments) {
      const r = await handleDebtPayment(userRef, uid, p.debtorName, p.amount, p.isPartial, type as 'pago-deuda-debo' | 'cobro-deuda-me-deben', source, now);
      lines.push(r.found
        ? formatDebtLine(p.debtorName, r)
        : `❌ No encontré deuda de "${p.debtorName}" — regístrala primero.`
      );
    }
    await send(lines.join('\n'));
    return { updatedHistory };
  }

  if (type === 'pago-deuda-debo' || type === 'cobro-deuda-me-deben') {
    if (debtorName) {
      const r = await handleDebtPayment(userRef, uid, debtorName, amount, isPartial ?? false, type, source, now);
      if (r.found) {
        await send(formatDebtMsg(debtorName, r, type));
      } else {
        const example = type === 'pago-deuda-debo'
          ? `"le debo [monto] a ${debtorName}"`
          : `"${debtorName} me debe [monto]"`;
        await send(`❌ No encontré una deuda de "${debtorName}".\nPrimero regístrala con: ${example}`);
      }
    } else {
      await send('⚠️ Para pagos de deudas menciona el nombre. Ej: "ya le pagué a Pedro".');
    }
    return { updatedHistory };
  }

  // ── Regular movements ──────────────────────────────────────────────────────
  const sr = await saveMovement(userRef, uid, result.data, source, now);

  // Venta: producto nuevo sin precio — pedir precio
  if (sr.needsVentaPrice && sr.concept) {
    await send(`No tengo "${sr.concept}" en el inventario. ¿A qué precio lo vendiste?`);
    return {
      updatedHistory,
      pendingState: { type: 'venta-nueva', concept: sr.concept, quantity: sr.quantity ?? 1, step: 'asking-precio-venta' },
    };
  }

  // Venta: precio especial
  if (sr.isPrecioEspecial) {
    const stockMsg = sr.newStock !== undefined ? `\n📦 Stock: ${sr.newStock} uds.` : '';
    await send(`${result.message}\n⚠️ *Precio especial:* $${sr.price!.toLocaleString('es-CO')} (precio habitual: $${sr.storedPrice!.toLocaleString('es-CO')}).${stockMsg}`);
    return { updatedHistory };
  }

  // Compra: producto nuevo sin precio — pedir precio antes de todo
  if (sr.isNewCompra && sr.needsCompraPrice && sr.concept) {
    await send(`¿A cuánto compraste ${sr.concept}?`);
    return {
      updatedHistory,
      pendingState: { type: 'compra-nueva', concept: sr.concept, quantity: sr.quantity ?? 1, step: 'asking-precio-compra' },
    };
  }

  // Compra: producto nuevo con precio — preguntar si va a vender
  if (sr.isNewCompra && sr.concept) {
    const qty = sr.quantity ?? 1;
    const pc = sr.precioCompra ?? 0;
    const totalStr = pc > 0 ? `$${(qty * pc).toLocaleString('es-CO')}` : `$${amount.toLocaleString('es-CO')}`;
    await send(`Listo, anoté el gasto de ${totalStr} por ${qty} ${sr.concept}. ¿Los vas a vender?`);
    return {
      updatedHistory,
      pendingState: { type: 'compra-nueva', concept: sr.concept, quantity: qty, precioCompra: pc, step: 'asking-si-vende' },
    };
  }

  // Compra: producto existente sin precio — stock ya actualizado, pedir precio para el gasto
  if (sr.needsCompraPrice && sr.concept) {
    const stockMsg = sr.newStock !== undefined ? ` Stock actualizado: ${sr.newStock} uds.` : '';
    await send(`Listo, actualicé el stock de *${sr.concept}*.${stockMsg}\n¿A cuánto los compraste? (para registrar el gasto)`);
    return {
      updatedHistory,
      pendingState: { type: 'compra-existente', concept: sr.concept, quantity: sr.quantity ?? 1, step: 'asking-precio-compra' },
    };
  }

  // Normal response — añadir info de stock si aplica
  const stockMsg = sr.newStock !== undefined ? `\n📦 Stock: ${sr.newStock} uds.` : '';
  await send(result.message + stockMsg);
  return { updatedHistory };
}

// ─── saveMovement ─────────────────────────────────────────────────────────────

async function saveMovement(
  userRef: DocumentReference,
  uid: string,
  data: NonNullable<import('./gemini.js').GeminiResponse['data']>,
  source: MessageSource,
  now: FieldValue,
): Promise<SaveMovementResult> {
  const { type, amount, concept, quantity, unitPrice, debtorName } = data;

  switch (type) {
    case 'venta': {
      const qty = quantity ?? 1;
      const foundProduct = await findInventoryProduct(userRef, concept);

      if (foundProduct) {
        const storedPrice: number = foundProduct.precioVenta ?? foundProduct.precioCompra ?? 0;
        const price = (unitPrice && unitPrice > 0) ? unitPrice : storedPrice;
        const total = price > 0 ? qty * price : amount;
        const newStock = Math.max(0, (foundProduct.cantidad ?? 0) - qty);
        const isPrecioEspecial = !!(unitPrice && unitPrice > 0 && storedPrice > 0 && unitPrice !== storedPrice);

        await userRef.collection('sales').add({
          items: [{ product: foundProduct.nombre, quantity: qty, unitPrice: price, subtotal: total }],
          total,
          createdAt: now,
          source,
        });
        await foundProduct.ref.update({ cantidad: newStock, updatedAt: now });
        return { isPrecioEspecial, price, storedPrice, newStock };
      }

      if (!amount || amount === 0) {
        return { needsVentaPrice: true, concept, quantity: qty };
      }

      const price = unitPrice ?? (qty > 1 ? Math.round(amount / qty) : amount);
      await userRef.collection('sales').add({
        items: [{ product: concept, quantity: qty, unitPrice: price, subtotal: amount }],
        total: amount,
        createdAt: now,
        source,
      });
      return {};
    }

    case 'compra': {
      const qty = quantity ?? 1;
      const precioCompra = unitPrice && unitPrice > 0
        ? unitPrice
        : (amount > 0 ? (qty > 1 ? Math.round(amount / qty) : amount) : 0);
      const total = precioCompra > 0 ? qty * precioCompra : amount;
      const foundProduct = await findInventoryProduct(userRef, concept);

      if (foundProduct) {
        const newStock = (foundProduct.cantidad ?? 0) + qty;
        if (precioCompra > 0) {
          await foundProduct.ref.update({ cantidad: newStock, precioCompra, updatedAt: now });
          await userRef.collection('expenses').add({
            concept: `Compra: ${concept}`,
            amount: total,
            createdAt: now,
            source,
          });
          return { newStock };
        } else {
          // Stock updated, expense missing price
          await foundProduct.ref.update({ cantidad: newStock, updatedAt: now });
          return { needsCompraPrice: true, concept: foundProduct.nombre, quantity: qty, newStock };
        }
      }

      // New product
      if (precioCompra > 0) {
        await userRef.collection('expenses').add({
          concept: `Compra: ${concept}`,
          amount: total,
          createdAt: now,
          source,
        });
        return { isNewCompra: true, concept, quantity: qty, precioCompra };
      } else {
        return { isNewCompra: true, needsCompraPrice: true, concept, quantity: qty };
      }
    }

    case 'gasto':
      await userRef.collection('expenses').add({ concept, amount, createdAt: now, source });
      return {};

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
      return {};

    default:
      console.warn(`[processMessage] Unhandled type: ${type} (uid: ${uid})`);
      return {};
  }
}

// ─── handleDebtPayment ────────────────────────────────────────────────────────

interface DebtPaymentResult {
  found: boolean;
  effectivePay: number;
  remaining: number;
  status: 'pagada' | 'parcial';
}

export async function handleDebtPayment(
  userRef: DocumentReference,
  uid: string,
  debtorName: string,
  amount: number,
  isPartial: boolean,
  type: 'pago-deuda-debo' | 'cobro-deuda-me-deben',
  source: MessageSource,
  now: FieldValue,
): Promise<DebtPaymentResult> {
  const debtType = type === 'pago-deuda-debo' ? 'debo' : 'me-deben';
  const debtsSnap = await userRef.collection('debts')
    .where('type', '==', debtType)
    .where('status', 'in', ['pendiente', 'parcial'])
    .get();

  const nameLower = debtorName.toLowerCase();
  const matchDoc = debtsSnap.docs.find(d => {
    const name = (d.data().name as string ?? '').toLowerCase();
    return name.includes(nameLower) || nameLower.includes(name);
  });

  if (!matchDoc) {
    console.warn(`[handleDebtPayment] No debt found for "${debtorName}" (uid: ${uid})`);
    return { found: false, effectivePay: 0, remaining: 0, status: 'parcial' };
  }

  const debtData = matchDoc.data();
  const prevPaid = (debtData.amountPaid as number | undefined) ?? 0;
  const totalDebt = debtData.amount as number;
  const effectivePay = amount > 0 ? amount : (totalDebt - prevPaid);
  const totalPaid = prevPaid + effectivePay;
  const remaining = Math.max(0, totalDebt - totalPaid);
  const isPaidOff = !isPartial && remaining <= 0;
  const status: 'pagada' | 'parcial' = isPaidOff ? 'pagada' : 'parcial';

  await matchDoc.ref.update({
    amountPaid: totalPaid,
    status,
    ...(isPaidOff ? { paidAt: now } : {}),
  });

  if (type === 'pago-deuda-debo') {
    await userRef.collection('expenses').add({
      concept: `Pago deuda: ${debtorName}`,
      amount: effectivePay,
      createdAt: now,
      source,
    });
  } else {
    await userRef.collection('sales').add({
      items: [{ product: `Cobro: ${debtorName}`, quantity: 1, unitPrice: effectivePay, subtotal: effectivePay }],
      total: effectivePay,
      createdAt: now,
      source,
    });
  }

  return { found: true, effectivePay, remaining, status };
}

// ─── Message formatters ───────────────────────────────────────────────────────

function formatDebtMsg(name: string, r: DebtPaymentResult, type: string): string {
  if (r.status === 'pagada') {
    const verb = type === 'pago-deuda-debo' ? 'Pagaste' : 'Cobraste';
    return `✅ ¡Deuda con ${name} saldada! ${verb} $${r.effectivePay.toLocaleString('es-CO')}.`;
  }
  const verb = type === 'pago-deuda-debo' ? 'a' : 'de';
  return `✅ Abono de $${r.effectivePay.toLocaleString('es-CO')} ${verb} ${name} registrado.\n💰 Pendiente: $${r.remaining.toLocaleString('es-CO')}`;
}

function formatDebtLine(name: string, r: DebtPaymentResult): string {
  if (r.status === 'pagada') return `✅ ${name}: saldada ($${r.effectivePay.toLocaleString('es-CO')})`;
  return `✅ ${name}: abono $${r.effectivePay.toLocaleString('es-CO')} — pendiente $${r.remaining.toLocaleString('es-CO')}`;
}
