import { useId, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Minus, Plus, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function Price({ value, compareAt, className }: { value: string; compareAt?: string | null; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-2 font-bold text-brand', className)}>
      <span>
        <span className="sr-only">Preço: </span>
        {formatEth(value)}
      </span>
      {compareAt && (
        <s className="font-normal text-tan">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(compareAt)}
        </s>
      )}
    </p>
  )
}

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
  label: string
  size?: 'sm' | 'md'
}) {
  const btn =
    size === 'sm'
      ? 'size-[22px] rounded-full bg-brand text-ink [&_svg]:size-3.5'
      : 'size-[30px] rounded-full bg-brand text-ink [&_svg]:size-5'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-3">
      <button
        type="button"
        className={cn('grid place-items-center hover:bg-brand-accent disabled:opacity-40', btn)}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus aria-hidden />
      </button>
      <output aria-live="polite" className={cn('min-w-5 text-center text-cream tabular-nums', size === 'sm' ? 'text-base' : 'text-lg')}>
        {value}
      </output>
      <button
        type="button"
        className={cn('grid place-items-center hover:bg-brand-accent disabled:opacity-40', btn)}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus aria-hidden />
      </button>
    </div>
  )
}

export function Field({
  label,
  required,
  error,
  help,
  className,
  children,
  hideLabel,
}: {
  label: string
  required?: boolean
  error?: string
  help?: string
  className?: string
  hideLabel?: boolean
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode
}) {
  const id = useId()
  const describedBy = [error ? `${id}-error` : null, help ? `${id}-help` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-[15px] text-cream', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy, required })}
      {help && !error && (
        <p id={`${id}-help`} className="text-xs text-tan">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-danger">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
  retrying,
  className,
}: {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-sm border border-line bg-surface px-6 py-10 text-center', className)}>
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <h2 className="text-base font-bold text-cream">{title}</h2>
      <p className="max-w-md text-sm text-sand">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} className="mt-2">
          <RotateCw className={cn(retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Tentando novamente...' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, message, action, className }: { title: string; message?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-sm border border-dashed border-line-soft px-6 py-12 text-center', className)}>
      <h2 className="text-base font-bold text-cream">{title}</h2>
      {message && <p className="max-w-md text-sm text-sand">{message}</p>}
      {action}
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-[15px] font-bold text-cream">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {item.to ? (
              <Link to={item.to} className="hover:text-brand-accent">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function LiveRegion({ message }: { message: string }) {
  const id = useId()
  return (
    <p id={id} role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  )
}
