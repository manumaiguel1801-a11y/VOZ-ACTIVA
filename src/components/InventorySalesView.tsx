import React, { useState } from 'react';
import { 
  Package, 
  ShoppingBag, 
  Plus, 
  Search, 
  ChevronRight, 
  ArrowUpRight,
  TrendingUp,
  Box,
  History
} from 'lucide-react';
import { cn } from '../lib/utils';

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  price: number;
  category: string;
}

interface SaleRecord {
  id: string;
  item: string;
  quantity: number;
  total: number;
  date: string;
}

const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Panela', stock: 24, price: 3500, category: 'Abarrotes' },
  { id: '2', name: 'Café Sello Rojo', stock: 12, price: 8500, category: 'Bebidas' },
  { id: '3', name: 'Aceite 1L', stock: 8, price: 12000, category: 'Abarrotes' },
  { id: '4', name: 'Arroz 1kg', stock: 45, price: 4200, category: 'Granos' },
];

const MOCK_SALES: SaleRecord[] = [
  { id: 's1', item: 'Panela', quantity: 2, total: 7000, date: 'Hoy, 10:30 AM' },
  { id: 's2', item: 'Aceite 1L', quantity: 1, total: 12000, date: 'Hoy, 09:15 AM' },
  { id: 's3', item: 'Café Sello Rojo', quantity: 1, total: 8500, date: 'Ayer' },
];

export const InventorySalesView = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventario' | 'ventas'>('inventario');

  return (
    <div className="space-y-6">
      {/* Header Selector */}
      <div className={cn(
        "flex p-1 rounded-2xl transition-colors",
        isDarkMode ? "bg-[#1A1A1A]" : "bg-[#f1f1ee]"
      )}>
        <button 
          onClick={() => setActiveSubTab('inventario')}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
            activeSubTab === 'inventario' 
              ? (isDarkMode ? "bg-[#B8860B] text-black shadow-lg" : "bg-white text-[#B8860B] shadow-sm")
              : "opacity-50"
          )}
        >
          <Package className="w-5 h-5" />
          Inventario
        </button>
        <button 
          onClick={() => setActiveSubTab('ventas')}
          className={cn(
            "flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
            activeSubTab === 'ventas' 
              ? (isDarkMode ? "bg-[#B8860B] text-black shadow-lg" : "bg-white text-[#B8860B] shadow-sm")
              : "opacity-50"
          )}
        >
          <ShoppingBag className="w-5 h-5" />
          Ventas
        </button>
      </div>

      {activeSubTab === 'inventario' ? (
        <InventorySection isDarkMode={isDarkMode} />
      ) : (
        <SalesSection isDarkMode={isDarkMode} />
      )}
    </div>
  );
};

const InventorySection = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex items-center gap-3">
      <div className={cn(
        "flex-1 h-12 rounded-xl flex items-center px-4 gap-2 border transition-all",
        isDarkMode ? "bg-[#1A1A1A] border-white/10" : "bg-white border-[#e8e8e5]"
      )}>
        <Search className="w-4 h-4 opacity-40" />
        <input 
          type="text" 
          placeholder="Buscar producto..." 
          className="bg-transparent border-none focus:ring-0 text-sm w-full"
        />
      </div>
      <button className="w-12 h-12 bg-[#B8860B] text-black rounded-xl flex items-center justify-center shadow-lg">
        <Plus className="w-6 h-6" />
      </button>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <StatCard 
        label="Productos" 
        value="42" 
        icon={<Box className="text-[#B8860B]" />} 
        isDarkMode={isDarkMode} 
      />
      <StatCard 
        label="Stock Bajo" 
        value="5" 
        icon={<TrendingUp className="text-red-500" />} 
        isDarkMode={isDarkMode} 
      />
    </div>

    <div className="space-y-3">
      <h3 className="font-bold text-lg px-1">Productos en Stock</h3>
      {MOCK_INVENTORY.map(item => (
        <div key={item.id} className={cn(
          "p-4 rounded-xl flex items-center justify-between transition-colors",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
        )}>
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
            <p className={cn(
              "text-xs font-bold",
              item.stock < 10 ? "text-red-500" : "opacity-50"
            )}>Stock: {item.stock}</p>
          </div>
        </div>
      ))}
      <button className="w-full py-3 text-[#B8860B] font-bold text-sm flex items-center justify-center gap-1">
        Ver más productos <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const SalesSection = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className={cn(
      "p-6 rounded-2xl bg-gradient-to-br from-[#B8860B] to-[#FFD700] text-black shadow-xl"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Ventas de Hoy</p>
          <h2 className="text-3xl font-black">$450.000</h2>
        </div>
        <div className="p-2 bg-black/10 rounded-lg">
          <TrendingUp className="w-6 h-6" />
        </div>
      </div>
      <div className="flex gap-2">
        <span className="bg-black/10 px-3 py-1 rounded-full text-[10px] font-bold">+15% vs ayer</span>
      </div>
    </div>

    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h3 className="font-bold text-lg">Historial de Ventas</h3>
        <History className="w-5 h-5 opacity-40" />
      </div>
      {MOCK_SALES.map(sale => (
        <div key={sale.id} className={cn(
          "p-4 rounded-xl flex items-center justify-between transition-colors",
          isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#B8860B]/10 rounded-lg flex items-center justify-center text-[#B8860B]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">{sale.item}</p>
              <p className="text-xs opacity-50">{sale.date} • Cant: {sale.quantity}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-[#B8860B]">${sale.total.toLocaleString()}</p>
            <div className="flex items-center justify-end text-[10px] text-green-500 font-bold">
              <ArrowUpRight className="w-3 h-3" /> EXITOSO
            </div>
          </div>
        </div>
      ))}
      <button className="w-full py-3 text-[#B8860B] font-bold text-sm flex items-center justify-center gap-1">
        Ver historial completo <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const StatCard = ({ label, value, icon, isDarkMode }: { label: string, value: string, icon: React.ReactNode, isDarkMode: boolean }) => (
  <div className={cn(
    "p-4 rounded-xl transition-colors",
    isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
  )}>
    <div className="flex justify-between items-start mb-2">
      <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-black">{value}</p>
  </div>
);
