import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';

interface Props {
  userId: string;
  isDarkMode: boolean;
  onClose: () => void;
}

export const RegisterSaleModal = ({ userId, isDarkMode, onClose }: Props) => {
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rawPrice, setRawPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const qty = Math.max(0, parseInt(quantity) || 0);
  const price = parseInt(rawPrice.replace(/\D/g, '')) || 0;
  const total = qty * price;
  const isValid = product.trim().length > 0 && qty > 0 && price > 0;

  const handlePriceChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    setRawPrice(digits ? parseInt(digits).toLocaleString('es-CO') : '');
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setError('');
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', userId, 'sales'), {
        product: product.trim(),
        quantity: qty,
        unitPrice: price,
        total,
        createdAt: serverTimestamp(),
      });
      setDone(true);
      setTimeout(onClose, 1000);
    } catch (e: any) {
      console.error(e);
      setError('No se pudo guardar. Verifica tu conexión.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Centered dialog */}
        <motion.div
          className={cn(
            'relative w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10',
            isDarkMode ? 'bg-[#1A1A1A] text-[#FDFBF0]' : 'bg-white text-[#0D0D0D]'
          )}
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-6 py-5 border-b',
            isDarkMode ? 'border-white/10' : 'border-black/5'
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD700]/20 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-[#B8860B]" />
              </div>
              <h2 className="text-xl font-black">Registrar Venta</h2>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Product */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest opacity-50">
                Producto vendido
              </label>
              <input
                type="text"
                placeholder="Ej: Almuerzos, Panela, Café..."
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className={cn(
                  'w-full h-13 px-4 py-3.5 rounded-xl text-sm font-medium border-2 outline-none transition-all',
                  isDarkMode
                    ? 'bg-[#2A2A2A] border-white/10 focus:border-[#B8860B] text-[#FDFBF0] placeholder:text-white/30'
                    : 'bg-[#f8f8f5] border-[#f0f0ec] focus:border-[#B8860B] placeholder:text-black/30'
                )}
              />
            </div>

            {/* Quantity + Unit price */}
            <div className="flex gap-3">
              <div className="space-y-2" style={{ width: '115px' }}>
                <label className="text-[11px] font-bold uppercase tracking-widest opacity-50">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={cn(
                    'w-full h-13 px-4 py-3.5 rounded-xl text-sm font-medium border-2 outline-none transition-all text-center',
                    isDarkMode
                      ? 'bg-[#2A2A2A] border-white/10 focus:border-[#B8860B] text-[#FDFBF0]'
                      : 'bg-[#f8f8f5] border-[#f0f0ec] focus:border-[#B8860B]'
                  )}
                />
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-[11px] font-bold uppercase tracking-widest opacity-50">
                  Precio unitario
                </label>
                <div className="relative">
                  <span className={cn(
                    'absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm select-none',
                    isDarkMode ? 'text-[#FDFBF0]/40' : 'text-black/40'
                  )}>$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={rawPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className={cn(
                      'w-full h-13 pl-7 pr-4 py-3.5 rounded-xl text-sm font-medium border-2 outline-none transition-all',
                      isDarkMode
                        ? 'bg-[#2A2A2A] border-white/10 focus:border-[#B8860B] text-[#FDFBF0] placeholder:text-white/30'
                        : 'bg-[#f8f8f5] border-[#f0f0ec] focus:border-[#B8860B] placeholder:text-black/30'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Total */}
            <div className={cn(
              'px-5 py-4 rounded-xl flex justify-between items-center',
              isDarkMode ? 'bg-[#B8860B]/10' : 'bg-[#FFF8DC]'
            )}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Total venta</p>
                <p className="text-xs opacity-40">{qty > 0 && price > 0 ? `${qty} × $${price.toLocaleString('es-CO')}` : '—'}</p>
              </div>
              <span className={cn(
                'text-3xl font-black',
                total > 0 ? 'text-[#B8860B]' : isDarkMode ? 'text-white/20' : 'text-black/20'
              )}>
                ${total.toLocaleString('es-CO')}
              </span>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium text-center">{error}</p>
            )}
          </div>

          {/* Footer with button — always visible */}
          <div className={cn(
            'flex-shrink-0 px-6 py-5 border-t',
            isDarkMode ? 'border-white/10' : 'border-black/5'
          )}>
            <button
              onClick={handleSave}
              disabled={!isValid || saving || done}
              className={cn(
                'w-full h-14 rounded-xl font-black text-base flex items-center justify-center gap-3 transition-all duration-300',
                done
                  ? 'bg-green-500 text-white'
                  : isValid
                    ? 'bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black shadow-lg active:scale-[0.98]'
                    : isDarkMode
                      ? 'bg-white/8 text-white/25 cursor-not-allowed'
                      : 'bg-black/8 text-black/25 cursor-not-allowed'
              )}
            >
              {done ? (
                <>
                  <Check className="w-5 h-5" />
                  ¡Venta registrada!
                </>
              ) : saving ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                'Guardar Venta'
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
