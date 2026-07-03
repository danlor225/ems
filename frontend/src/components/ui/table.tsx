// ============================================================
//  Table — primitives de tableau (design system).
//  En-tête sticky, lignes séparées, hover. Tokens => dark-ready.
// ============================================================
import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-muted/60 backdrop-blur', className)}
      {...props}
    />
  )
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-border', className)} {...props} />
  )
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-muted/40', className)}
      {...props}
    />
  )
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />
}
