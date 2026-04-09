import React, { useState } from 'react';
import { 
  Upload, 
  CheckCircle2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Debt {
  id: string;
  name: string;
  amount: number;
  date: string;
  type: 'me-deben' | 'debo';
  tag: string;
}

const MOCK_DEBTS: Debt[] = [
  { id: 'd1', name: 'Doña Rosa Pérez', amount: 45500, date: '12 Oct', type: 'me-deben', tag: 'PANELA Y CAFÉ' },
  { id: 'd2', name: 'Lucho el Mecánico', amount: 12200, date: 'Hoy', type: 'me-deben', tag: 'CIGARRILLOS' },
  { id: 'd3', name: 'Proveedor Harina', amount: 150000, date: 'Hace 1 semana', type: 'debo', tag: 'INSUMOS' },
  { id: 'd4', name: 'Luz Local', amount: 85000, date: 'Vence mañana', type: 'debo', tag: 'SERVICIOS' },
];

export const CameraView = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [debtType, setDebtType] = useState<'me-deben' | 'debo'>('me-deben');

  const filteredDebts = MOCK_DEBTS.filter(d => d.type === debtType);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-[2rem] bg-black aspect-[3/4] shadow-2xl">
        <img 
          src="https://picsum.photos/seed/ledger/600/800" 
          alt="Scanner" 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-between p-8">
          <div className="w-full flex justify-between">
            <div className="w-10 h-10 border-t-4 border-l-4 border-[#FFD700] rounded-tl-xl"></div>
            <div className="w-10 h-10 border-t-4 border-r-4 border-[#FFD700] rounded-tr-xl"></div>
          </div>
          <div className="text-center px-4">
            <p className="text-white text-xl font-black drop-shadow-2xl mb-3">Apunta a tu cuaderno</p>
            <div className="h-1.5 w-48 bg-white/20 mx-auto rounded-full overflow-hidden">
              <div className="h-full bg-[#FFD700] w-1/3 animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
          <div className="w-full flex justify-between">
            <div className="w-10 h-10 border-b-4 border-l-4 border-[#FFD700] rounded-bl-xl"></div>
            <div className="w-10 h-10 border-b-4 border-r-4 border-[#FFD700] rounded-br-xl"></div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className={cn(
          "flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95",
          isDarkMode ? "bg-[#1A1A1A] text-[#FDFBF0] border border-white/5" : "bg-white text-[#2e2f2d] shadow-sm"
        )}>
          <Upload className="w-5 h-5" />
          Subir Foto
        </button>
        <button className="flex-[1.5] h-14 bg-gradient-to-br from-[#B8860B] to-[#FFD700] rounded-2xl flex items-center justify-center gap-2 font-bold text-black shadow-lg active:scale-95 transition-all">
          <CheckCircle2 className="w-5 h-5" />
          Confirmar
        </button>
      </div>

      <section className="space-y-6">
        <div className="flex justify-between items-end px-1">
          <div>
            <h2 className="text-2xl font-black text-[#B8860B] font-['Plus_Jakarta_Sans']">Deudas y Fiados</h2>
            <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Control de cartera</p>
          </div>
          <button className="flex items-center gap-2 bg-[#B8860B] text-black px-4 py-2 rounded-xl shadow-lg active:scale-90 transition-transform">
            <UserPlus className="w-5 h-5" />
            <span className="text-xs font-bold">Nuevo Cliente</span>
          </button>
        </div>

        {/* Debt Type Selector */}
        <div className={cn(
          "flex p-1 rounded-2xl transition-colors",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-[#f1f1ee]"
        )}>
          <button 
            onClick={() => setDebtType('me-deben')}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              debtType === 'me-deben' 
                ? (isDarkMode ? "bg-[#B8860B] text-black shadow-lg" : "bg-white text-[#B8860B] shadow-sm")
                : "opacity-50"
            )}
          >
            <ArrowUpRight className="w-4 h-4" />
            Me deben
          </button>
          <button 
            onClick={() => setDebtType('debo')}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
              debtType === 'debo' 
                ? (isDarkMode ? "bg-[#B8860B] text-black shadow-lg" : "bg-white text-[#B8860B] shadow-sm")
                : "opacity-50"
            )}
          >
            <ArrowDownRight className="w-4 h-4" />
            Debo
          </button>
        </div>

        <div className="space-y-3">
          {filteredDebts.map((item, i) => (
            <div key={i} className={cn(
              "p-5 rounded-2xl flex items-center justify-between shadow-sm border-l-4 transition-all duration-500",
              isDarkMode ? "bg-[#1A1A1A]" : "bg-white",
              item.type === 'me-deben' ? "border-[#B8860B]" : "border-red-500/50"
            )}>
              <div>
                <p className="font-bold text-lg">{item.name}</p>
                <p className="text-xs opacity-40">Vence: {item.date}</p>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-black text-xl",
                  item.type === 'me-deben' ? "text-[#B8860B]" : "opacity-70"
                )}>${item.amount.toLocaleString()}</p>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                  isDarkMode ? "bg-[#FFD700]/10 text-[#FFD700]" : "bg-[#FFF8DC] text-[#483000]"
                )}>{item.tag}</span>
              </div>
            </div>
          ))}
          
          <button className={cn(
            "w-full py-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
            isDarkMode ? "border-white/10 text-white/40 hover:bg-white/5" : "border-black/5 text-black/40 hover:bg-black/5"
          )}>
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="font-bold text-sm">Registrar deuda manual</span>
            </div>
            <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">Sin escanear foto</span>
          </button>
        </div>
      </section>
    </div>
  );
};
