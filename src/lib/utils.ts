import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Primera letra de cada palabra en mayúscula. "manuel perez" → "Manuel Perez" */
export const capitalizar = (str: string): string =>
  str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * Detecta el género gramatical de un nombre de producto en español
 * basándose en la última letra alfabética del nombre.
 *
 * - Termina en "a"  → 'femenino'  (Manzanas, Gaseosas, Papas)
 * - Termina en "o"  → 'masculino' (Tintos, Jugos, Huevos)
 * - Otro            → 'neutro'    (Arroz, Pan, Leche)
 */
export type Genero = 'femenino' | 'masculino' | 'neutro';

export function detectarGenero(nombre: string): Genero {
  // Quita caracteres no alfabéticos del final (espacios, números, signos)
  const clean = nombre.trim().toLowerCase().replace(/[^a-záéíóúüñ]+$/i, '');
  const lastChar = clean.slice(-1);
  if (lastChar === 'a') return 'femenino';
  if (lastChar === 'o') return 'masculino';
  return 'neutro';
}
