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

export interface Sale {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: any;
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
  createdAt: any;
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
