import { useId } from 'react'
import { RadioGroup } from 'radix-ui'
import type { Edition, EditionId } from '@/api/contracts'
import { cn } from '@/lib/utils'

/** "Edição:" pills — a real radiogroup; sold-out editions are disabled and labelled. */
export function EditionPicker({
  editions,
  value,
  onChange,
  size = 'md',
}: {
  editions: Edition[]
  value: EditionId | null
  onChange: (id: EditionId) => void
  size?: 'md' | 'lg'
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className={cn('font-bold text-cream', size === 'lg' ? 'text-base' : 'text-sm')}>
        Edição:
      </span>
      <RadioGroup.Root
        aria-labelledby={labelId}
        value={value ?? undefined}
        onValueChange={(v) => onChange(v as EditionId)}
        orientation="horizontal"
        loop
        className="flex flex-wrap gap-2"
      >
        {editions.map((e) => {
          const soldOut = e.available === 0
          return (
            <RadioGroup.Item
              key={e.id}
              value={e.id}
              disabled={soldOut}
              aria-label={soldOut ? `${e.label} (esgotada)` : e.label}
              data-testid={`edition-${e.id}`}
              className={cn(
                'rounded-full border px-2 py-0.5 text-cream transition-colors hover:border-brand focus-visible:ring-2 focus-visible:ring-brand-accent',
                size === 'lg' ? 'min-w-[52px] text-sm leading-6' : 'text-xs leading-5',
                'border-line-soft bg-transparent',
                'data-[state=checked]:border-brand data-[state=checked]:bg-surface-dark data-[state=checked]:font-bold',
                'disabled:cursor-not-allowed disabled:border-line disabled:text-tan disabled:line-through disabled:hover:border-line',
              )}
            >
              {e.label}
            </RadioGroup.Item>
          )
        })}
      </RadioGroup.Root>
    </div>
  )
}
