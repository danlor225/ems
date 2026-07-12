// ============================================================
//  StatCard — carte de KPI (label, valeur, icône, indice).
// ============================================================
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './card'

type StatTone = 'primary' | 'sky' | 'info' | 'success' | 'warning' | 'danger'

// Pastille d'icône par tonalité — n'utilise que les tokens de la charte.
const toneChip: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  sky: 'bg-sky/15 text-sky',
  info: 'bg-info/10 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  hint?: string
  tone?: StatTone
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'primary',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div
          className={cn(
            'grid size-9 place-items-center rounded-lg',
            toneChip[tone],
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
