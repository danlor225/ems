// ============================================================
//  NativeSelect — <select> stylé au design system.
//  (Un Select Radix accessible viendra si besoin d'options riches.)
// ============================================================
import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function NativeSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-soft transition-[border-color,box-shadow]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
