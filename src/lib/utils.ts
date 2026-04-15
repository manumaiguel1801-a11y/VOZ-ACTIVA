import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Primera letra de cada palabra en mayúscula. "manuel perez" → "Manuel Perez" */
export const capitalizar = (str: string): string =>
  str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * Detecta el género/número gramatical de un nombre de producto en español
 * analizando la terminación de la ÚLTIMA palabra del nombre.
 *
 * Reglas (por orden de prioridad):
 *   "as"       → 'femenino'  — Manzanas, Gaseosas, Papas
 *   "os" | "es"→ 'masculino' — Tintos, Jugos, Limones
 *   otro       → 'neutro'    — Arroz, Pan, Jugo de Naranja, Leche
 *
 * Uso en consejos de stock bajo:
 *   femenino  → "Te quedan pocas Manzanas, solo 2 unidades."
 *   masculino → "Te quedan pocos Tintos, solo 3 unidades."
 *   neutro    → "Te queda poco Arroz, solo 1 unidad."
 */
export type Genero = 'femenino' | 'masculino' | 'neutro';

export function detectarGenero(nombre: string): Genero {
  const words = nombre.trim().split(/\s+/);
  const lastWord = words[words.length - 1].toLowerCase();
  if (lastWord.endsWith('as')) return 'femenino';
  if (lastWord.endsWith('os') || lastWord.endsWith('es')) return 'masculino';
  return 'neutro';
}
