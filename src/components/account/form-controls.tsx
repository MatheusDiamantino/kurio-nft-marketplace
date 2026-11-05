import { forwardRef, useState, type ComponentProps } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Base look of Kurio form inputs (Figma: 1px #3F2319 border, 40px high, transparent). */
export const inputClass =
  'h-10 w-full min-w-0 rounded-[2px] border border-line bg-transparent px-3 text-sm text-cream placeholder:text-tan outline-none transition-colors focus-visible:border-brand-accent aria-[invalid=true]:border-danger disabled:opacity-60'

export const TextInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />
})

export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<'input'>, 'type'> & { toggleLabel?: string }>(
  function PasswordInput({ className, toggleLabel = 'Mostrar senha', ...props }, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input ref={ref} type={visible ? 'text' : 'password'} className={cn(inputClass, 'pr-11', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={toggleLabel}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-tan hover:text-brand-accent"
        >
          {visible ? <Eye className="size-[18px]" aria-hidden /> : <EyeOff className="size-[18px]" aria-hidden />}
        </button>
      </div>
    )
  },
)

export const NativeSelect = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, 'appearance-none pr-10 [&>option]:bg-ink', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-cream" aria-hidden />
    </div>
  )
})

/** ".eth" suffix selector (decorative, single option) + ENS name input. */
export const EnsInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function EnsInput({ className, ...props }, ref) {
  return (
    <div className="flex gap-2.5">
      <span className="flex h-10 shrink-0 items-center gap-2 rounded-[2px] border border-line px-3 text-sm text-cream" aria-hidden>
        .eth
        <ChevronDown className="size-4" />
      </span>
      <input ref={ref} className={cn(inputClass, className)} {...props} />
    </div>
  )
})
