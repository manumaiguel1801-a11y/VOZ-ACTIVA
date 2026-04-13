import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Primera letra de cada palabra en mayúscula. "manuel perez" → "Manuel Perez" */
export const capitalizar = (str: string): string =>
  str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
