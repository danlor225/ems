// ============================================================
//  Label — étiquette de champ, liée à l'input via htmlFor.
// ============================================================
import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-sm font-medium text-foreground select-none',
        className,
      )}
      {...props}
    />
  )
}
