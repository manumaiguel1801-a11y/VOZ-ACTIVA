import React, { useState, useMemo } from 'react';
import {
  Upload,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  Users,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Debt } from '../types';
import { MovementDetailModal } from './MovementDetailModal';

function getDebtDate(debt: Debt): Date {
  return debt.createdAt?.toDate ? debt.createdAt.toDate() : new Date();
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return 'Hoy';
  if (d.getTime() === yesterday.getTime()) return 'Ayer';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

interface Props {
  isDarkMode: boolean;
  debts: Debt[];
}

export const CameraView = ({ isDarkMode, debts }: Props) => {
  const [debtType, setDebtType] = useState<'me-deben' | 'debo'>('me-deben');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  const filteredDebts = debts.filter(
    (d) => d.type === debtType && (d.status ?? 'pendiente') !== 'pagada'
  );

  const { totalMeDeben, totalDebo } = useMemo(() => ({
    totalMeDeben: debts
      .filter((d) => d.type === 'me-deben' && (d.status ?? 'pendiente') !== 'pagada')
      .reduce((s, d) => s + (d.amount - (d.amountPaid ?? 0)), 0),
    totalDebo: debts
      .filter((d) => d.type === 'debo' && (d.status ?? 'pendiente') !== 'pagada')
      .reduce((s, d) => s + (d.amount - (d.amountPaid ?? 0)), 0),
  }), [debts]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Camera scanner area */}
      <div className="relative overflow-hidden rounded-[2rem] bg-black aspect-[3/4] shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-between p-8">
          <div className="w-full flex justify-between">
            <div className="w-10 h-10 border-t-4 border-l-4 border-[#FFD700] rounded-tl-xl" />
            <div className="w-10 h-10 border-t-4 border-r-4 border-[#FFD700] rounded-tr-xl" />
          </div>
          <div className="text-center px-4">
            <p className="text-white text-xl font-black drop-shadow-2xl mb-3">Apunta a tu cuaderno</p>
            <div className="h-1.5 w-48 bg-white/20 mx-auto rounded-full overflow-hidden">
              <div className="h-full bg-[#FFD700] w-1/3 animate-pulse" />
            </div>
          </div>
          <div className="w-full flex justify-between">
            <div className="w-10 h-10 border-b-4 border-l-4 border-[#FFD700] rounded-bl-xl" />
            <div className="w-10 h-10 border-b-4 border-r-4 border-[#FFD700] rounded-br-xl" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className={cn(
          'flex-1 h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95',
          isDarkMode ? 'bg-[#1A1A1A] text-[#FDFBF0] border border-white/5' : 'bg-white text-[#2e2f2d] shadow-sm'
        )}>
          <Upload className="w-5 h-5" />
          Subir Foto
        </button>
        <button className="flex-[1.5] h-14 bg-gradient-to-br from-[#B8860B] to-[#FFD700] rounded-2xl flex items-center justify-center gap-2 font-bold text-black shadow-lg active:scale-95 transition-all">
          <CheckCircle2 className="w-5 h-5" />
          Confirmar
        </button>
      </div>

      {/* Deudas y Fiados */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-1">
          <div>
            <h2 className="text-2xl font-black text-[#B8860B] font-['Plus_Jakarta_Sans']">Deudas y Fiados</h2>
            <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Control de cartera</p>
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn('p-4 rounded-xl border-l-4 border-[#B8860B]', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Me deben</p>
            <p className="text-xl font-black text-[#B8860B]">${totalMeDeben.toLocaleString('es-CO')}</p>
          </div>
          <div className={cn('p-4 rounded-xl border-l-4 border-red-400/60', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Debo</p>
            <p className="text-xl font-black opacity-80">${totalDebo.toLocaleString('es-CO')}</p>
          </div>
        </div>

        {/* Tab selector */}
        <div className={cn('flex p-1 rounded-2xl transition-colors', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f1ee]')}>
          <button
            onClick={() => setDebtType('me-deben')}
            className={cn(
              'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
              debtType === 'me-deben'
                ? isDarkMode ? 'bg-[#B8860B] text-black shadow-lg' : 'bg-white text-[#B8860B] shadow-sm'
                : 'opacity-50'
            )}
          >
            <ArrowUpRight className="w-4 h-4" />
            Me deben
          </button>
          <button
            onClick={() => setDebtType('debo')}
            className={cn(
              'flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
              debtType === 'debo'
                ? isDarkMode ? 'bg-[#B8860B] text-black shadow-lg' : 'bg-white text-[#B8860B] shadow-sm'
                : 'opacity-50'
            )}
          >
            <ArrowDownRight className="w-4 h-4" />
            Debo
          </button>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredDebts.length === 0 ? (
            <div className={cn('p-10 rounded-2xl flex flex-col items-center justify-center gap-3 text-center', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', isDarkMode ? 'bg-[#2A2A2A]' : 'bg-[#f1f1ee]')}>
                <Users className={cn('w-7 h-7', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/40')} />
              </div>
              <p className={cn('font-bold', isDarkMode ? 'text-[#FDFBF0]/60' : 'text-[#5b5c5a]')}>
                {debtType === 'me-deben' ? 'Nadie te debe por ahora' : 'No tienes deudas registradas'}
              </p>
              <p className={cn('text-xs', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/60')}>
                Dile al asistente "{debtType === 'me-deben' ? 'Juan me debe 20 mil' : 'le debo 50 mil al proveedor'}"
              </p>
            </div>
          ) : (
            filteredDebts.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedDebt(item)}
                className={cn(
                  'w-full p-5 rounded-2xl flex items-center justify-between shadow-sm border-l-4 transition-all duration-200 active:scale-[0.98] text-left',
                  isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white',
                  item.type === 'me-deben' ? 'border-[#B8860B]' : 'border-red-500/50'
                )}
              >
                <div>
                  <p className="font-bold text-lg">{item.name}</p>
                  <p className="text-xs opacity-40">{item.concept} · {formatRelativeDate(getDebtDate(item))}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-right">
                    <p className={cn('font-black text-xl', item.type === 'me-deben' ? 'text-[#B8860B]' : 'opacity-70')}>
                      ${(item.amount - (item.amountPaid ?? 0)).toLocaleString('es-CO')}
                    </p>
                    {item.status === 'parcial' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-700">
                        PARCIAL
                      </span>
                    ) : (
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                        isDarkMode ? 'bg-[#FFD700]/10 text-[#FFD700]' : 'bg-[#FFF8DC] text-[#483000]'
                      )}>
                        {item.type === 'me-deben' ? 'A COBRAR' : 'A PAGAR'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn('w-4 h-4 flex-shrink-0', isDarkMode ? 'text-white/20' : 'text-black/20')} />
                </div>
              </button>
            ))
          )}

          <button className={cn(
            'w-full py-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors',
            isDarkMode ? 'border-white/10 text-white/40 hover:bg-white/5' : 'border-black/5 text-black/40 hover:bg-black/5'
          )}>
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="font-bold text-sm">Registrar deuda manual</span>
            </div>
            <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">O usa el asistente de chat</span>
          </button>
        </div>
      </section>

      {selectedDebt && (
        <MovementDetailModal
          item={{ kind: 'debt', data: selectedDebt }}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedDebt(null)}
        />
      )}
    </div>
  );
};
