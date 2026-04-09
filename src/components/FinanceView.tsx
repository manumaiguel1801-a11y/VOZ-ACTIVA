import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter,
  ShoppingBag,
  Fuel,
  Banknote,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import { Transaction } from '../types';

const TRANSACTIONS: Transaction[] = [
  { 
    id: '1', 
    title: 'Venta de almuerzos', 
    amount: 85000, 
    time: 'Hace 20 min', 
    type: 'income',
    icon: <ShoppingBag className="w-6 h-6" />,
    color: 'bg-[#ffc96f]'
  },
  { 
    id: '2', 
    title: 'Gasolina moto', 
    amount: -15000, 
    time: 'Hoy, 8:30 AM', 
    type: 'expense',
    icon: <Fuel className="w-6 h-6" />,
    color: 'bg-[#f6cfc2]'
  },
  { 
    id: '3', 
    title: 'Abono Doña Rosa', 
    amount: 40000, 
    time: 'Ayer', 
    type: 'income',
    icon: <Banknote className="w-6 h-6" />,
    color: 'bg-[#ffc96f]'
  },
];

const WEEKLY_DATA = [
  { name: 'L', value: 45 },
  { name: 'M', value: 65 },
  { name: 'X', value: 100 },
  { name: 'J', value: 75 },
  { name: 'V', value: 35 },
  { name: 'S', value: 40 },
  { name: 'D', value: 25 },
];

export const FinanceView = ({ isDarkMode }: { isDarkMode: boolean }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-5 rounded-2xl transition-all",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
        )}>
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Ingresos</span>
          </div>
          <p className="text-2xl font-black text-[#B8860B]">$1.250.000</p>
          <p className="text-[10px] opacity-40 mt-1">Este mes</p>
        </div>
        <div className={cn(
          "p-5 rounded-2xl transition-all",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
        )}>
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <ArrowDownRight className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Gastos</span>
          </div>
          <p className="text-2xl font-black opacity-80">$450.000</p>
          <p className="text-[10px] opacity-40 mt-1">Este mes</p>
        </div>
      </div>

      {/* Chart Section */}
      <section className={cn(
        "rounded-2xl p-6 transition-colors duration-500",
        isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
      )}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold">Flujo de Caja</h3>
            <p className="text-xs opacity-50">Últimos 7 días</p>
          </div>
          <div className="flex items-center gap-1 text-[#B8860B] font-bold text-sm">
            <TrendingUp className="w-4 h-4" />
            +12%
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={WEEKLY_DATA}>
              <Bar 
                dataKey="value" 
                radius={[6, 6, 0, 0]}
              >
                {WEEKLY_DATA.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.value === 100 ? '#FFD700' : '#B8860B'} 
                    fillOpacity={entry.value === 100 ? 1 : 0.3}
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

      {/* Transactions List */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xl font-bold">Movimientos</h3>
          <div className="flex gap-2">
            <button className={cn(
              "p-2 rounded-lg transition-colors",
              isDarkMode ? "bg-[#1A1A1A] text-[#FDFBF0]/60 hover:bg-[#2A2A2A]" : "bg-white text-[#5b5c5a] hover:bg-[#f1f1ee] shadow-sm"
            )}>
              <Calendar className="w-4 h-4" />
            </button>
            <button className={cn(
              "p-2 rounded-lg transition-colors",
              isDarkMode ? "bg-[#1A1A1A] text-[#FDFBF0]/60 hover:bg-[#2A2A2A]" : "bg-white text-[#5b5c5a] hover:bg-[#f1f1ee] shadow-sm"
            )}>
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {TRANSACTIONS.map((t) => (
            <div key={t.id} className={cn(
              "p-5 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all duration-500",
              isDarkMode ? "bg-[#1A1A1A]" : "bg-white"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-[#2e2f2d]", t.color)}>
                  {t.icon}
                </div>
                <div>
                  <p className="font-bold text-sm">{t.title}</p>
                  <p className="text-[10px] opacity-50">{t.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-black text-lg",
                  t.type === 'income' ? "text-[#B8860B]" : (isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]")
                )}>
                  {t.amount > 0 ? `+$${t.amount.toLocaleString()}` : `-$${Math.abs(t.amount).toLocaleString()}`}
                </p>
                <span className="text-[8px] font-bold uppercase tracking-tighter opacity-30">Confirmado</span>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full py-4 bg-[#B8860B]/10 text-[#B8860B] rounded-2xl font-bold text-sm hover:bg-[#B8860B]/20 transition-colors">
          Ver reporte detallado
        </button>
      </section>
    </div>
  );
};
