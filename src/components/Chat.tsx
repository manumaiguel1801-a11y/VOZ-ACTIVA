import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle2, Send, Loader2, ShoppingBag, TrendingDown, UserMinus, UserPlus, Mic, Square } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { sendMessageToGemini, ChatResponse } from '../services/gemini';

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

interface Message {
  role: 'user' | 'model';
  text: string;
  data?: ChatResponse['data'];
  timestamp: Date;
  saved?: boolean;
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'venta':           { label: 'Venta registrada',    icon: <ShoppingBag className="w-4 h-4" />,  color: 'text-[#B8860B]' },
  'gasto':           { label: 'Gasto registrado',    icon: <TrendingDown className="w-4 h-4" />, color: 'text-red-500' },
  'deuda-me-deben':  { label: 'Deuda a cobrar',      icon: <UserPlus className="w-4 h-4" />,     color: 'text-[#B8860B]' },
  'deuda-debo':      { label: 'Deuda registrada',    icon: <UserMinus className="w-4 h-4" />,    color: 'text-orange-500' },
};

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
}

export const Chat = ({ isDarkMode, userId }: Props) => {
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
  const interimRef = useRef(''); // tracks interim transcript so we can replace it

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    interimRef.current = '';
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    setMicError('');

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'es-CO';
    recognition.continuous = false;      // stops naturally after a pause
    recognition.interimResults = true;   // real-time feedback while speaking
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      interimRef.current = '';
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }
      // Replace the current input with live transcription
      setInput((prev) => {
        // Strip previous interim result (stored in ref) and append new
        const base = prev.endsWith(interimRef.current)
          ? prev.slice(0, prev.length - interimRef.current.length)
          : prev;
        interimRef.current = final ? '' : interim;
        return base + (final || interim);
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setMicError('Permiso de micrófono denegado. Habilítalo en la configuración del navegador.');
      } else if (event.error === 'no-speech') {
        // Silently ignore — user didn't say anything
      } else {
        setMicError('No se pudo usar el micrófono. Intenta de nuevo.');
      }
      setIsListening(false);
      recognitionRef.current = null;
      interimRef.current = '';
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      interimRef.current = '';
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

      // Save to Firestore if financial data detected
      let saved = false;
      if (response.data && userId) {
        try {
          await saveToFirestore(userId, response.data);
          saved = true;
        } catch (e) {
          console.error('Error saving from chat:', e);
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'model', text: response.message, data: response.data, timestamp: new Date(), saved },
      ]);
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

              {msg.data && (
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
            'flex-1 backdrop-blur-xl rounded-2xl h-12 px-4 flex items-center shadow-lg border transition-all duration-500',
            isListening
              ? isDarkMode ? 'bg-[#1A1A1A]/90 border-red-500/50' : 'bg-white/90 border-red-400/50'
              : isDarkMode ? 'bg-[#1A1A1A]/90 border-white/10' : 'bg-white/90 border-[#e8e8e5]'
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
