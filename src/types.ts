import React from 'react';

export type Tab = 'inicio' | 'finanzas' | 'camara' | 'inventario' | 'pasaporte' | 'perfil';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  time: string;
  type: 'income' | 'expense';
  icon: React.ReactNode;
  color: string;
}

export interface SaleItem {
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];   // multi-product
  total: number;
  createdAt: any;
  // legacy fields for old single-product sales
  product?: string;
  quantity?: number;
  unitPrice?: number;
}

export function getSaleLabel(sale: Sale): string {
  if (sale.items?.length) {
    if (sale.items.length === 1) return sale.items[0].product;
    return `${sale.items[0].product} y ${sale.items.length - 1} más`;
  }
  return sale.product ?? 'Venta';
}

export function getSaleQtyLabel(sale: Sale): string {
  if (sale.items?.length > 1) return `${sale.items.length} productos`;
  const qty = sale.items?.[0]?.quantity ?? sale.quantity ?? 1;
  return qty > 1 ? `×${qty}` : '';
}

export interface Expense {
  id: string;
  concept: string;
  amount: number;
  createdAt: any;
}

export interface Debt {
  id: string;
  name: string;      // nombre del deudor o acreedor
  concept: string;
  amount: number;
  type: 'me-deben' | 'debo';
  status?: 'pendiente' | 'parcial' | 'pagada';
  amountPaid?: number;  // acumulado de abonos
  paidAt?: any;
  createdAt: any;
}

export interface InventoryProduct {
  id: string;
  nombre: string;
  cantidad: number;
  valorUnitario: number;
  createdAt: any;
  updatedAt?: any;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  birthDate: string;
  email?: string;
  createdAt: any; // Timestamp
}
