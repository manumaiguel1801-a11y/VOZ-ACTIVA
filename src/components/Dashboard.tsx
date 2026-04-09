import React from 'react';
import { 
  Plus, 
  ShoppingBag, 
  Fuel, 
  Banknote,
  Filter
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

export const Dashboard = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="space-y-8">
    {/* Hero Card */}
    <section className={cn(
      "rounded-xl p-8 shadow-[0_8px_32px_rgba(184,134,11,0.15)] relative overflow-hidden transition-all duration-500",
      isDarkMode 
        ? "bg-gradient-to-br from-[#B8860B] to-[#DAA520] text-black" 
        : "bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black"
    )}>
      <div className="relative z-10">
        <p className="text-sm opacity-90 mb-1">Saldo total</p>
        <h2 className="text-5xl font-extrabold tracking-tight mb-6">$2.450.000</h2>
        <div className="flex gap-4">
          <div className="flex-1 bg-black/5 backdrop-blur-md p-4 rounded-lg">
            <p className="text-xs opacity-80 mb-1">Ingresos de hoy</p>
            <p className="text-xl font-bold">+$125.000</p>
          </div>
          <div className="flex-1 bg-black/5 backdrop-blur-md p-4 rounded-lg">
            <p className="text-xs opacity-80 mb-1">Gastos</p>
            <p className="text-xl font-bold">-$42.000</p>
          </div>
        </div>
      </div>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#DAA520] rounded-full blur-[80px] opacity-40"></div>
    </section>

    {/* Main CTA */}
    <button className="w-full h-16 bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform">
      <Plus className="w-6 h-6" />
      Registrar Venta
    </button>

    {/* Weekly Chart */}
    <section className={cn(
      "rounded-lg p-6 transition-colors duration-500",
      isDarkMode ? "bg-[#1A1A1A]" : "bg-[#f1f1ee]"
    )}>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-lg font-bold">Ganancias de la semana</h3>
          <p className={cn(
            "text-sm",
            isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"
          )}>Rendimiento semanal</p>
        </div>
        <span className="text-[#B8860B] font-bold text-lg">+12%</span>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEKLY_DATA}>
            <Bar 
              dataKey="value" 
              radius={[10, 10, 0, 0]}
            >
              {WEEKLY_DATA.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.value === 100 ? '#FFD700' : entry.value > 60 ? '#DAA520' : (isDarkMode ? '#333' : '#ddddd9')} 
                />
              ))}
            </Bar>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fontWeight: 500, fill: isDarkMode ? '#FDFBF0' : '#2e2f2d', opacity: 0.6 }} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>

    {/* Transactions */}
    <section className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Movimientos recientes</h3>
        <div className="flex gap-2">
          <button className={cn(
            "p-2 rounded-lg transition-colors",
            isDarkMode ? "bg-[#1A1A1A] text-[#FDFBF0]/60 hover:bg-[#2A2A2A]" : "bg-[#f1f1ee] text-[#5b5c5a] hover:bg-[#e3e3df]"
          )}>
            <Filter className="w-4 h-4" />
          </button>
          <button className="text-[#B8860B] font-bold text-sm">Ver todo</button>
        </div>
      </div>
      <div className="space-y-3">
        {TRANSACTIONS.map((t) => (
          <div key={t.id} className={cn(
            "p-5 rounded-lg flex items-center justify-between shadow-sm active:scale-[0.98] transition-all duration-500",
            isDarkMode ? "bg-[#1A1A1A]" : "bg-white"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-[#2e2f2d]", t.color)}>
                {t.icon}
              </div>
              <div>
                <p className="font-bold">{t.title}</p>
                <p className={cn(
                  "text-sm",
                  isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"
                )}>{t.time}</p>
              </div>
            </div>
            <p className={cn("font-bold", t.type === 'income' ? "text-[#B8860B]" : (isDarkMode ? "text-[#FDFBF0]/60" : "text-[#5b5c5a]"))}>
              {t.amount > 0 ? `+$${t.amount.toLocaleString()}` : `-$${Math.abs(t.amount).toLocaleString()}`}
            </p>
          </div>
        ))}
      </div>
    </section>
  </div>
);
