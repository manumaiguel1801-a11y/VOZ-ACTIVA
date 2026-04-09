import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  CheckCircle2,
  Send,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { sendMessageToGemini, ChatResponse } from '../services/gemini';

interface Message {
  role: 'user' | 'model';
  text: string;
  data?: ChatResponse['data'];
  timestamp: Date;
}

export const Chat = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: '¡Hola! Soy tu asistente de Voz-Activa. ¿Qué ventas o gastos has realizado hoy?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Prepare history for Gemini (excluding timestamps and data for now to match SDK expectations)
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await sendMessageToGemini(input, history);

    const aiMessage: Message = {
      role: 'model',
      text: response.message,
      data: response.data,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={scrollRef}
        className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10"
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={cn(
              "flex flex-col max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === 'user' ? "items-end self-end" : "items-start"
            )}
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-sm transition-all duration-500",
              msg.role === 'user' 
                ? "bg-[#FFD700] text-black rounded-tr-none" 
                : (isDarkMode ? "bg-[#1A1A1A] text-[#FDFBF0] rounded-tl-none" : "bg-[#f1f1ee] text-[#2e2f2d] rounded-tl-none")
            )}>
              <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
              
              {msg.data && (
                <div className={cn(
                  "mt-3 p-3 rounded-xl border-l-4 flex items-center gap-3",
                  isDarkMode ? "bg-black/20 border-[#B8860B]" : "bg-white/50 border-[#B8860B]"
                )}>
                  <div className="w-8 h-8 rounded-full bg-[#B8860B]/20 flex items-center justify-center text-[#B8860B]">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {msg.data.type === 'venta' ? 'Venta Registrada' : msg.data.type === 'gasto' ? 'Gasto Registrado' : 'Deuda Registrada'}
                    </p>
                    <p className="text-sm font-black text-[#B8860B]">
                      ${msg.data.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <span className={cn(
              "text-[8px] uppercase tracking-widest mt-1 opacity-40 font-bold",
              msg.role === 'user' ? "mr-1" : "ml-1"
            )}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex flex-col items-start max-w-[90%] animate-pulse">
            <div className={cn(
              "p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2",
              isDarkMode ? "bg-[#1A1A1A]" : "bg-[#f1f1ee]"
            )}>
              <Loader2 className="w-4 h-4 animate-spin text-[#B8860B]" />
              <span className="text-xs font-bold opacity-50">Procesando...</span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex-1 backdrop-blur-xl rounded-2xl h-12 px-4 flex items-center shadow-lg border transition-all duration-500",
            isDarkMode ? "bg-[#1A1A1A]/90 border-white/10" : "bg-white/90 border-[#e8e8e5]"
          )}>
            <input 
              className={cn(
                "bg-transparent border-none focus:ring-0 w-full text-sm font-medium transition-colors",
                isDarkMode ? "text-[#FDFBF0] placeholder:text-[#FDFBF0]/30" : "text-[#2e2f2d] placeholder:text-[#5b5c5a]/50"
              )}
              placeholder="Escribe aquí..." 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={cn(
              "w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all shrink-0",
              input.trim() 
                ? "bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black" 
                : "bg-gray-500/20 text-gray-500 opacity-50"
            )}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
