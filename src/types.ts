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

export interface UserProfile {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  birthDate: string;
  email?: string;
  createdAt: any; // Timestamp
}
