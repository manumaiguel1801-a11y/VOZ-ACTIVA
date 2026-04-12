import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle2, Send, Loader2, ShoppingBag, TrendingDown, UserMinus, UserPlus, Mic, Square, AlertCircle, CreditCard } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { sendMessageToGemini, ChatResponse } from '../services/gemini';
import { Debt } from '../types';

// Web Speech API — not in standard TS lib; declare minimal types
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
    : null;

interface DebtPaymentResult {
  found: boolean;
  debtorName: string;
  amount: number;
  isPartial: boolean;
  status?: 'pagada' | 'parcial';
  remaining?: number;
  paymentType?: 'pago-deuda-debo' | 'cobro-deuda-me-deben';
}

interface Message {
  role: 'user' | 'model';
  text: string;
  data?: ChatResponse['data'];
  timestamp: Date;
  saved?: boolean;
  debtResults?: DebtPaymentResult[];
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'venta':                 { label: 'Venta registrada',    icon: <ShoppingBag className="w-4 h-4" />,  color: 'text-[#B8860B]' },
  'gasto':                 { label: 'Gasto registrado',    icon: <TrendingDown className="w-4 h-4" />, color: 'text-red-500' },
  'deuda-me-deben':        { label: 'Deuda a cobrar',      icon: <UserPlus className="w-4 h-4" />,     color: 'text-[#B8860B]' },
  'deuda-debo':            { label: 'Deuda registrada',    icon: <UserMinus className="w-4 h-4" />,    color: 'text-orange-500' },
  'pago-deuda-debo':       { label: 'Pago de deuda',       icon: <CreditCard className="w-4 h-4" />,   color: 'text-green-500' },
  'cobro-deuda-me-deben':  { label: 'Cobro de deuda',      icon: <CreditCard className="w-4 h-4" />,   color: 'text-[#B8860B]' },
};

// Normaliza texto eliminando tildes y pasando a minúsculas para fuzzy match
function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Busca una deuda pendiente/parcial que coincida con el nombre dado
function findDebt(debts: Debt[], name: string, debtType: 'me-deben' | 'debo'): Debt | null {
  const n = normalizeStr(name);
  if (!n) return null;
  return debts.find(d =>
    d.type === debtType &&
    (d.status ?? 'pendiente') !== 'pagada' &&
    (normalizeStr(d.name).includes(n) || n.includes(normalizeStr(d.name)))
  ) ?? null;
}

// Aplica un pago (total o abono) a una deuda en Firestore
async function applyDebtPayment(
  userId: string,
  debt: Debt,
  paymentAmount: number,
  isPartial: boolean,
): Promise<{ status: 'pagada' | 'parcial'; remaining: number; effectivePayment: number }> {
  const alreadyPaid = debt.amountPaid ?? 0;
  // Si amount=0 significa pago total del saldo restante
  const effectivePayment = paymentAmount > 0 ? paymentAmount : debt.amount - alreadyPaid;
  const totalPaid = alreadyPaid + effectivePayment;
  const remaining = Math.max(0, debt.amount - totalPaid);
  const newStatus: 'pagada' | 'parcial' = (remaining <= 0 || !isPartial) ? 'pagada' : 'parcial';

  await updateDoc(doc(db, 'users', userId, 'debts', debt.id), {
    status: newStatus,
    amountPaid: totalPaid,
    ...(newStatus === 'pagada' ? { paidAt: serverTimestamp() } : {}),
  });

  return { status: newStatus, remaining, effectivePayment };
}

async function saveToFirestore(userId: string, data: NonNullable<ChatResponse['data']>): Promise<void> {
  const base = { concept: data.concept, amount: data.amount, createdAt: serverTimestamp() };

  if (data.type === 'venta') {
    const qty = data.quantity ?? 1;
    const unitPrice = data.unitPrice ?? data.amount;
    await addDoc(collection(db, 'users', userId, 'sales'), {
      items: [{ product: data.concept, quantity: qty, unitPrice, subtotal: data.amount }],
      total: data.amount,
      createdAt: serverTimestamp(),
    });
  } else if (data.type === 'gasto') {
    await addDoc(collection(db, 'users', userId, 'expenses'), base);
  } else if (data.type === 'deuda-me-deben') {
    await addDoc(collection(db, 'users', userId, 'debts'), {
      ...base,
      name: data.debtorName || data.concept,
      type: 'me-deben',
    });
  } else if (data.type === 'deuda-debo') {
    await addDoc(collection(db, 'users', userId, 'debts'), {
      ...base,
      name: data.debtorName || data.concept,
      type: 'debo',
    });
  }
}

interface Props {
  isDarkMode: boolean;
  userId: string;
  debts: Debt[];
}

export const Chat = ({ isDarkMode, userId, debts }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: '¡Hola! Soy tu asistente de Voz-Activa. Cuéntame tus ventas, gastos o deudas y las registro al instante.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Voice input state ──────────────────────────────────────────────
  const voiceSupported = SpeechRecognitionAPI !== null;
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    setMicError('');
    setInput(''); // clear input before recording so transcript is clean

    const recognition = new SpeechRecognitionAPI();
    // es-CO = Colombian Spanish — best available for costeño/barranquillero dialect
    recognition.lang = 'es-CO';
    recognition.continuous = false;    // stops naturally after a pause
    recognition.interimResults = true; // show text in real-time while speaking
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Always rebuild the full transcript from ALL results (0..length).
      // This avoids the duplication bug that comes from iterating only
      // from event.resultIndex and trying to do string-slice surgery on prev state.
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setMicError('Permiso de micrófono denegado. Habilítalo en ajustes del navegador.');
      } else if (event.error !== 'no-speech') {
        setMicError('No se pudo usar el micrófono. Intenta de nuevo.');
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);
  // ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

    try {
      const response = await sendMessageToGemini(input, history);
      const dataType = response.data?.type;
      const isDebtPayment = dataType === 'pago-deuda-debo' || dataType === 'cobro-deuda-me-deben';

      if (isDebtPayment && response.data) {
        // ── Flujo de pago / cobro de deuda ──────────────────────────────
        const debtType = dataType === 'pago-deuda-debo' ? 'debo' : 'me-deben';

        // Construye la lista de pagos (uno o varios)
        const rawPayments = response.data.payments?.length
          ? response.data.payments
          : [{ debtorName: response.data.debtorName ?? response.data.concept ?? '', amount: response.data.amount, isPartial: response.data.isPartial ?? false }];

        const debtResults: DebtPaymentResult[] = [];

        for (const p of rawPayments) {
          const matched = findDebt(debts, p.debtorName, debtType);
          if (matched) {
            try {
              const result = await applyDebtPayment(userId, matched, p.amount, p.isPartial);
              debtResults.push({
                found: true,
                debtorName: p.debtorName,
                amount: result.effectivePayment,
                isPartial: p.isPartial,
                paymentType: dataType as 'pago-deuda-debo' | 'cobro-deuda-me-deben',
                ...result,
              });
              // Create a financial movement so it appears in Dashboard and FinanceView
              if (dataType === 'pago-deuda-debo') {
                await addDoc(collection(db, 'users', userId, 'expenses'), {
                  concept: `Pago deuda: ${matched.name}`,
                  amount: result.effectivePayment,
                  createdAt: serverTimestamp(),
                });
              } else {
                await addDoc(collection(db, 'users', userId, 'sales'), {
                  items: [{ product: `Cobro: ${matched.name}`, quantity: 1, unitPrice: result.effectivePayment, subtotal: result.effectivePayment }],
                  total: result.effectivePayment,
                  createdAt: serverTimestamp(),
                });
              }
            } catch (e) {
              console.error('Error updating debt:', e);
              debtResults.push({ found: true, debtorName: p.debtorName, amount: p.amount, isPartial: p.isPartial, paymentType: dataType as 'pago-deuda-debo' | 'cobro-deuda-me-deben' });
            }
          } else {
            debtResults.push({ found: false, debtorName: p.debtorName, amount: p.amount, isPartial: p.isPartial, paymentType: dataType as 'pago-deuda-debo' | 'cobro-deuda-me-deben' });
          }
        }

        const allFound = debtResults.every(r => r.found);
        setMessages((prev) => [...prev, {
          role: 'model',
          text: response.message,
          data: response.data,
          timestamp: new Date(),
          saved: allFound,
          debtResults,
        }]);

      } else {
        // ── Flujo normal: venta / gasto / registro de deuda nueva ────────
        let saved = false;
        if (response.data && userId) {
          try {
            await saveToFirestore(userId, response.data);
            saved = true;
          } catch (e) {
            console.error('Error saving from chat:', e);
          }
        }
        setMessages((prev) => [...prev, {
          role: 'model',
          text: response.message,
          data: response.data,
          timestamp: new Date(),
          saved,
        }]);
      }
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      console.error('Chat error:', e);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: `Error: ${errMsg}`, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              'flex flex-col max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300',
              msg.role === 'user' ? 'items-end self-end' : 'items-start'
            )}
          >
            <div className={cn(
              'p-4 rounded-2xl shadow-sm transition-all duration-500',
              msg.role === 'user'
                ? 'bg-[#FFD700] text-black rounded-tr-none'
                : isDarkMode ? 'bg-[#1A1A1A] text-[#FDFBF0] rounded-tl-none' : 'bg-[#f1f1ee] text-[#2e2f2d] rounded-tl-none'
            )}>
              <p className="text-sm font-medium leading-relaxed">{msg.text}</p>

              {/* Card para ventas / gastos / registro de deudas nuevas */}
              {msg.data && !msg.debtResults && (
                <div className={cn(
                  'mt-3 p-3 rounded-xl border-l-4 flex items-center gap-3',
                  isDarkMode ? 'bg-black/20 border-[#B8860B]' : 'bg-white/60 border-[#B8860B]'
                )}>
                  <div className="w-8 h-8 rounded-full bg-[#B8860B]/20 flex items-center justify-center text-[#B8860B]">
                    {TYPE_LABELS[msg.data.type]?.icon ?? <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {TYPE_LABELS[msg.data.type]?.label ?? msg.data.type}
                      {msg.saved ? ' · ✓ Guardado' : ' · ⚠ No guardado'}
                    </p>
                    <p className={cn('text-sm font-black', TYPE_LABELS[msg.data.type]?.color ?? 'text-[#B8860B]')}>
                      ${msg.data.amount.toLocaleString('es-CO')}
                      {msg.data.debtorName && (
                        <span className="text-xs font-bold opacity-60 ml-2">— {msg.data.debtorName}</span>
                      )}
                    </p>
                    <p className="text-[10px] opacity-40 truncate">{msg.data.concept}</p>
                  </div>
                </div>
              )}

              {/* Cards para resultados de pago/cobro de deudas */}
              {msg.debtResults && msg.debtResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.debtResults.map((r, i) => (
                    <div
                      key={i}
                      className={cn(
                        'p-3 rounded-xl border-l-4 flex items-center gap-3',
                        r.found
                          ? r.status === 'pagada'
                            ? isDarkMode ? 'bg-green-500/10 border-green-500' : 'bg-green-50 border-green-500'
                            : isDarkMode ? 'bg-amber-500/10 border-amber-400' : 'bg-amber-50 border-amber-400'
                          : isDarkMode ? 'bg-red-500/10 border-red-400' : 'bg-red-50 border-red-400'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        r.found
                          ? r.status === 'pagada' ? 'bg-green-500/20 text-green-500' : 'bg-amber-400/20 text-amber-500'
                          : 'bg-red-400/20 text-red-400'
                      )}>
                        {r.found
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <AlertCircle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                          {r.found
                            ? r.status === 'pagada' ? 'Deuda saldada ✓' : 'Abono registrado ✓'
                            : 'Deuda no encontrada'}
                        </p>
                        <p className="text-sm font-black truncate">{r.debtorName}</p>
                        {r.found && r.status === 'parcial' && r.remaining != null && (
                          <p className="text-[10px] opacity-60">
                            Abono: ${r.amount.toLocaleString('es-CO')} · Pendiente: ${r.remaining.toLocaleString('es-CO')}
                          </p>
                        )}
                        {r.found && r.status === 'pagada' && (
                          <p className="text-[10px] opacity-60">Pagado: ${r.amount.toLocaleString('es-CO')}</p>
                        )}
                        {!r.found && (
                          <p className="text-[10px] opacity-60">
                            Regístrala primero diciéndome:{' '}
                            <span className="font-bold">
                              "{r.paymentType === 'pago-deuda-debo'
                                ? `le debo [monto] a ${r.debtorName}`
                                : `${r.debtorName} me debe [monto]`}"
                            </span>{' '}
                            y luego repite el pago.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span className={cn(
              'text-[8px] uppercase tracking-widest mt-1 opacity-40 font-bold',
              msg.role === 'user' ? 'mr-1' : 'ml-1'
            )}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start max-w-[90%]">
            <div className={cn(
              'p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2',
              isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f1ee]'
            )}>
              <Loader2 className="w-4 h-4 animate-spin text-[#B8860B]" />
              <span className="text-xs font-bold opacity-50">Procesando...</span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 space-y-2">
        {/* Mic permission error */}
        {micError && (
          <p className="text-xs font-medium text-red-400 text-center px-2">{micError}</p>
        )}

        <div className="flex items-center gap-2">
          {/* Input field */}
          <div className={cn(
            'flex-1 backdrop-blur-xl rounded-2xl h-12 px-4 flex items-center shadow-lg transition-all duration-500',
            isListening
              ? isDarkMode ? 'bg-[#1A1A1A]/90 ring-1 ring-red-500/50' : 'bg-white/90 ring-1 ring-red-400/50'
              : isDarkMode ? 'bg-[#1A1A1A]/90' : 'bg-white/90'
          )}>
            {isListening && (
              /* Pulsing dot while recording */
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2 shrink-0" />
            )}
            <input
              className={cn(
                'bg-transparent border-none focus:ring-0 w-full text-sm font-medium transition-colors',
                isDarkMode ? 'text-[#FDFBF0] placeholder:text-[#FDFBF0]/30' : 'text-[#2e2f2d] placeholder:text-[#5b5c5a]/50'
              )}
              placeholder={isListening ? 'Escuchando...' : 'Ej: vendí 3 almuerzos por 45 mil...'}
              type="text"
              value={input}
              onChange={(e) => { if (!isListening) setInput(e.target.value); }}
              onKeyDown={(e) => e.key === 'Enter' && !isListening && handleSend()}
            />
          </div>

          {/* Mic button — only shown when Web Speech API is available */}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              title={isListening ? 'Detener grabación' : 'Dictar mensaje'}
              className={cn(
                'w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all shrink-0',
                isListening
                  ? 'bg-red-500 text-white'
                  : isDarkMode
                    ? 'bg-white/10 text-[#FFD700] hover:bg-white/15'
                    : 'bg-black/5 text-[#B8860B] hover:bg-black/10'
              )}
            >
              {isListening
                ? <Square className="w-4 h-4 fill-current" />
                : <Mic className="w-5 h-5" />}
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || isListening}
            className={cn(
              'w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all shrink-0',
              input.trim() && !isListening
                ? 'bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black'
                : 'bg-gray-500/20 text-gray-500 opacity-50'
            )}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
