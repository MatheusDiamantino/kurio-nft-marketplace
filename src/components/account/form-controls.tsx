import { forwardRef, useState, type ComponentProps, type Ref } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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

export const selectTriggerClass =
  'w-full rounded-[2px] border-line bg-transparent px-3 text-sm text-cream shadow-none outline-none transition-colors data-[size=default]:h-10 focus-visible:border-brand-accent focus-visible:ring-0 aria-[invalid=true]:border-danger data-[placeholder]:text-tan dark:bg-transparent dark:hover:bg-transparent [&_svg:not([class*=text-])]:text-cream [&_svg]:opacity-100'

export const selectContentClass = 'border-line-soft bg-surface text-cream'
export const selectItemClass = 'focus:bg-surface-dark focus:text-brand-accent'

export interface FormSelectOption {
  value: string
  label: string
}

export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  name,
  ref,
  onBlur,
  ...aria
}: {
  ref?: Ref<HTMLButtonElement>
  onBlur?: () => void
  value: string | undefined
  onValueChange: (v: string) => void
  options: readonly FormSelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  name?: string
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
  required?: boolean
}) {
  const { required: _required, ...triggerAria } = aria
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled} name={name}>
      <SelectTrigger ref={ref} onBlur={onBlur} {...triggerAria} className={cn(selectTriggerClass, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className={selectContentClass}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className={selectItemClass}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

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
