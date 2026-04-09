import React, { useState, useMemo } from 'react';
import {
  Package, ShoppingBag, Plus, Search,
  TrendingUp, Box, History, ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Sale, getSaleLabel, getSaleQtyLabel } from '../types';

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  price: number;
  category: string;
}

const INVENTORY: InventoryItem[] = [];

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
}

export const InventorySalesView = ({ isDarkMode, sales }: Props) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventario' | 'ventas'>('inventario');

  return (
    <div className="space-y-6">
      <div className={cn('flex p-1 rounded-2xl transition-colors', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f1ee]')}>
        <button
          onClick={() => setActiveSubTab('inventario')}
          className={cn(
            'flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
            activeSubTab === 'inventario'
              ? isDarkMode ? 'bg-[#B8860B] text-black shadow-lg' : 'bg-white text-[#B8860B] shadow-sm'
              : 'opacity-50'
          )}
        >
          <Package className="w-5 h-5" />
          Inventario
        </button>
        <button
          onClick={() => setActiveSubTab('ventas')}
          className={cn(
            'flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
            activeSubTab === 'ventas'
              ? isDarkMode ? 'bg-[#B8860B] text-black shadow-lg' : 'bg-white text-[#B8860B] shadow-sm'
              : 'opacity-50'
          )}
        >
          <ShoppingBag className="w-5 h-5" />
          Ventas
        </button>
      </div>

      {activeSubTab === 'inventario' ? (
        <InventorySection isDarkMode={isDarkMode} />
      ) : (
        <SalesSection isDarkMode={isDarkMode} sales={sales} />
      )}
    </div>
  );
};

const InventorySection = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center gap-3">
      <div className={cn('flex-1 h-12 rounded-xl flex items-center px-4 gap-2 border transition-all', isDarkMode ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-[#e8e8e5]')}>
        <Search className="w-4 h-4 opacity-40" />
        <input type="text" placeholder="Buscar producto..." className="bg-transparent border-none focus:ring-0 text-sm w-full" />
      </div>
      <button className="w-12 h-12 bg-[#B8860B] text-black rounded-xl flex items-center justify-center shadow-lg">
        <Plus className="w-6 h-6" />
      </button>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <StatCard label="Productos" value={String(INVENTORY.length)} icon={<Box className={cn(isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')} />} isDarkMode={isDarkMode} />
      <StatCard label="Stock Bajo" value="0" icon={<TrendingUp className={cn(isDarkMode ? 'text-[#FDFBF0]/40' : 'text-[#5b5c5a]/60')} />} isDarkMode={isDarkMode} />
    </div>

    <div className="space-y-3">
      <h3 className="font-bold text-lg px-1">Productos en Stock</h3>
      {INVENTORY.length === 0 ? (
        <EmptyState
          icon={<Package className={cn('w-7 h-7', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/40')} />}
          title="Sin productos aún"
          subtitle='Toca "+" para agregar tu primer producto'
          isDarkMode={isDarkMode}
        />
      ) : (
        INVENTORY.map((item) => (
          <div key={item.id} className={cn('p-4 rounded-xl flex items-center justify-between transition-colors', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD700]/10 rounded-lg flex items-center justify-center text-[#B8860B]">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-xs opacity-50">{item.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-[#B8860B]">${item.price.toLocaleString()}</p>
              <p className={cn('text-xs font-bold', item.stock < 10 ? 'text-red-500' : 'opacity-50')}>Stock: {item.stock}</p>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

const SalesSection = ({ isDarkMode, sales }: { isDarkMode: boolean; sales: Sale[] }) => {
  const todayTotal = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return sales.filter((s) => getSaleDate(s) >= midnight).reduce((sum, s) => sum + s.total, 0);
  }, [sales]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Ventas de Hoy</p>
            <h2 className="text-3xl font-black">${todayTotal.toLocaleString('es-CO')}</h2>
          </div>
          <div className="p-2 bg-black/10 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
        <div className="flex gap-2">
          <span className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-bold">
            {sales.filter((s) => {
              const m = new Date(); m.setHours(0,0,0,0);
              return getSaleDate(s) >= m;
            }).length} ventas hoy
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-lg">Historial de Ventas</h3>
          <History className="w-5 h-5 opacity-40" />
        </div>

        {sales.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className={cn('w-7 h-7', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/40')} />}
            title="Sin ventas aún"
            subtitle="Registra tu primera venta desde el inicio"
            isDarkMode={isDarkMode}
          />
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className={cn('p-4 rounded-xl flex items-center justify-between transition-colors', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#B8860B]/10 rounded-lg flex items-center justify-center text-[#B8860B]">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">{getSaleLabel(sale)}</p>
                  <p className="text-xs opacity-50">
                    {formatRelativeTime(getSaleDate(sale))}
                    {getSaleQtyLabel(sale) && ` · ${getSaleQtyLabel(sale)}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#B8860B]">${sale.total.toLocaleString('es-CO')}</p>
                <div className="flex items-center justify-end text-[10px] text-green-500 font-bold">
                  <ArrowUpRight className="w-3 h-3" /> EXITOSO
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, isDarkMode }: { label: string; value: string; icon: React.ReactNode; isDarkMode: boolean }) => (
  <div className={cn('p-4 rounded-xl transition-colors', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
    <div className="flex justify-between items-start mb-2">
      <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-black">{value}</p>
  </div>
);

const EmptyState = ({ icon, title, subtitle, isDarkMode }: { icon: React.ReactNode; title: string; subtitle: string; isDarkMode: boolean }) => (
  <div className={cn('p-10 rounded-xl flex flex-col items-center justify-center gap-3 text-center', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
    <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', isDarkMode ? 'bg-[#2A2A2A]' : 'bg-[#f1f1ee]')}>
      {icon}
    </div>
    <p className={cn('font-bold', isDarkMode ? 'text-[#FDFBF0]/60' : 'text-[#5b5c5a]')}>{title}</p>
    <p className={cn('text-xs', isDarkMode ? 'text-[#FDFBF0]/30' : 'text-[#5b5c5a]/60')}>{subtitle}</p>
  </div>
);
