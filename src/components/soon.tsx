import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Out-of-scope destinations (editorial pages, support, activity, offers,
 * downloads...). They stay visible to preserve the layout, but are clearly
 * announced as unavailable instead of pretending to work.
 */
export function notifySoon(label: string) {
  toast.info(`${label} ainda não está disponível nesta demonstração.`)
}

export function SoonLink({ label, children, className }: { label: string; children?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => notifySoon(label)}
      aria-describedby="soon-hint"
      className={cn('text-left hover:text-brand-accent focus-visible:text-brand-accent', className)}
    >
      {children ?? label}
    </button>
  )
}

/** Hidden helper text referenced by every SoonLink (rendered once in the layout). */
export function SoonHint() {
  return (
    <span id="soon-hint" className="sr-only">
      Seção indisponível nesta demonstração
    </span>
  )
}
