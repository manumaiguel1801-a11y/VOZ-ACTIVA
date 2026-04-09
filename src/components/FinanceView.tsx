import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, BarChart2, TrendingUp, ShoppingBag } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { Sale, Expense, getSaleLabel, getSaleQtyLabel } from '../types';

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function getSaleDate(sale: Sale): Date {
  return sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const saleDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (saleDay.getTime() === today.getTime()) return `Hoy, ${timeStr}`;
  if (saleDay.getTime() === yesterday.getTime()) return `Ayer, ${timeStr}`;
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + `, ${timeStr}`;
}

interface Props {
  isDarkMode: boolean;
  sales: Sale[];
  expenses: Expense[];
}

export const FinanceView = ({ isDarkMode, sales, expenses }: Props) => {
  // Month totals
  const { monthIncome, monthExpenses } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthIncome = 0;
    let monthExpenses = 0;
    sales.forEach((s) => {
      if (getSaleDate(s) >= monthStart) monthIncome += s.total;
    });
    expenses.forEach((e) => {
      const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date();
      if (d >= monthStart) monthExpenses += e.amount;
    });
    return { monthIncome, monthExpenses };
  }, [sales, expenses]);

  // Weekly chart
  const weeklyData = useMemo(() => {
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        name: DAY_NAMES[d.getDay()],
        value: 0,
        ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      };
    });
    sales.forEach((s) => {
      const d = getSaleDate(s);
      const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const entry = result.find((r) => r.ts === dayTs);
      if (entry) entry.value += s.total;
    });
    return result;
  }, [sales]);

  const maxBar = Math.max(...weeklyData.map((d) => d.value), 1);
  const weekTotal = weeklyData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn('p-5 rounded-2xl transition-all', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Ingresos</span>
          </div>
          <p className="text-2xl font-black text-[#B8860B]">${monthIncome.toLocaleString('es-CO')}</p>
          <p className="text-[10px] opacity-40 mt-1">Este mes</p>
        </div>
        <div className={cn('p-5 rounded-2xl transition-all', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <ArrowDownRight className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Gastos</span>
          </div>
          <p className="text-2xl font-black opacity-80">${monthExpenses.toLocaleString('es-CO')}</p>
          <p className="text-[10px] opacity-40 mt-1">Este mes</p>
        </div>
      </div>

      {/* Chart */}
      <section className={cn('rounded-2xl p-6 transition-colors duration-500', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold">Flujo de Caja</h3>
            <p className="text-xs opacity-50">Últimos 7 días</p>
          </div>
          <div className={cn('flex items-center gap-1 font-bold text-sm', 'text-[#B8860B]')}>
            <TrendingUp className="w-4 h-4" />
            ${weekTotal.toLocaleString('es-CO')}
          </div>
        </div>
        <div className="h-48 w-full" style={{ minHeight: 192 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.value > 0 && entry.value === maxBar
                        ? '#FFD700'
                        : entry.value > maxBar * 0.6
                          ? '#B8860B'
                          : isDarkMode ? '#333' : '#e3e3df'
                    }
                    fillOpacity={entry.value > 0 ? 1 : 0.5}
                  />
                ))}
              </Bar>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#FDFBF0' : '#2e2f2d', opacity: 0.4 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Transaction list */}
      <section className="space-y-4">
        <div className="px-1">
          <h3 className="text-xl font-bold">Movimientos</h3>
        </div>

        {sales.length === 0 ? (
          <div className={cn('p-10 rounded-2xl flex flex-col items-center justify-center gap-3 text-center', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
            <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', isDarkMode ? 'bg-[#2A2A2A]' : 'bg-[#f1f1ee]')}>
              <BarChart2 className={cn('w-7 h-7', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/40')} />
            </div>
            <p className={cn('font-bold', isDarkMode ? 'text-[#FDFBF0]/60' : 'text-[#5b5c5a]')}>Sin movimientos aún</p>
            <p className={cn('text-xs', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/60')}>Aquí verás tu historial financiero</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((s) => (
              <div
                key={s.id}
                className={cn('p-5 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all duration-500', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white')}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#ffc96f] flex items-center justify-center text-[#2e2f2d]">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{getSaleLabel(s)}</p>
                    <p className="text-[10px] opacity-50">
                      {formatRelativeTime(getSaleDate(s))}
                      {getSaleQtyLabel(s) && ` · ${getSaleQtyLabel(s)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-[#B8860B]">+${s.total.toLocaleString('es-CO')}</p>
                  <span className="text-[8px] font-bold uppercase tracking-tighter opacity-30">Confirmado</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
