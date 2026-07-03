// ============================================================
//  cn : fusionne des classes conditionnelles (clsx) en résolvant
//  les conflits Tailwind (tailwind-merge). Base de tous les
//  composants du design system.
// ============================================================
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
