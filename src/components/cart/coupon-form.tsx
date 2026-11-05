import { useId, useState, type FormEvent } from 'react'
import { AlertTriangle, Tag, X } from 'lucide-react'
import type { AppliedCoupon } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { useApplyCoupon, useRemoveCoupon } from '@/queries/cart'

export function CouponForm({ coupon }: { coupon: AppliedCoupon | null }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Informe o código promocional.')
      return
    }
    setError(null)
    apply.mutate(code.trim(), {
      onSuccess: () => setCode(''),
      onError: (err) => {
        if (isApiError(err)) {
          setError(
            err.code === 'COUPON_EXPIRED'
              ? `Cupom expirado: ${err.message}`
              : err.code === 'COUPON_INVALID'
                ? `Cupom inválido: ${err.message}`
                : err.message,
          )
        } else setError('Não foi possível aplicar o cupom.')
      },
    })
  }

  if (coupon) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-cream">Código promocional</p>
        <div className="flex items-center justify-between gap-3 rounded-sm border border-brand bg-surface-dark/50 px-3 py-2">
          <p className="flex items-center gap-2 text-sm text-cream">
            <Tag className="size-4 text-brand" aria-hidden />
            <span>
              <strong className="text-brand">{coupon.code}</strong> - {coupon.description}
            </span>
          </p>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="inline-flex items-center gap-1 text-sm text-sand hover:text-brand-accent disabled:opacity-50"
            aria-label={`Remover cupom ${coupon.code}`}
          >
            <X className="size-4" aria-hidden />
            Remover
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={`${id}-code`} className="text-sm font-bold text-cream">
        Código promocional
      </label>
      <div className="flex h-10 md:h-10">
        <input
          id={`${id}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className="min-w-0 flex-1 rounded-l-sm border border-brand bg-transparent px-2 text-xs text-cream uppercase placeholder:text-tan placeholder:normal-case aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className="rounded-r-sm bg-brand px-5 text-[15px] font-bold text-ink hover:bg-brand-accent disabled:opacity-60"
        >
          {apply.isPending ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1 text-xs text-danger">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </form>
  )
}
