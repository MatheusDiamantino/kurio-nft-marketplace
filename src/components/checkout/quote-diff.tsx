import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import type { Quote } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { compare, formatEth } from '@/lib/eth'

interface Change {
  key: string
  text: string
}

export function diffQuotes(before: Quote, after: Quote): Change[] {
  const changes: Change[] = []
  for (const line of after.lines) {
    const prev = before.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    if (!prev) {
      changes.push({ key: `add:${line.nftId}:${line.editionId}`, text: `${line.name} (${line.editionLabel}) foi adicionado.` })
      continue
    }
    if (compare(prev.unitPrice, line.unitPrice) !== 0) {
      changes.push({
        key: `price:${line.nftId}:${line.editionId}`,
        text: `${line.name}: preço de ${formatEth(prev.unitPrice)} para ${formatEth(line.unitPrice)}.`,
      })
    }
    if (prev.quantity !== line.quantity) {
      changes.push({
        key: `qty:${line.nftId}:${line.editionId}`,
        text: `${line.name}: quantidade de ${prev.quantity} para ${line.quantity}.`,
      })
    }
  }
  for (const prev of before.lines) {
    if (!after.lines.some((l) => l.nftId === prev.nftId && l.editionId === prev.editionId)) {
      changes.push({ key: `rm:${prev.nftId}:${prev.editionId}`, text: `${prev.name} (${prev.editionLabel}) saiu do pedido.` })
    }
  }
  if (compare(before.discount, after.discount) !== 0) {
    changes.push({ key: 'discount', text: `Desconto de ${formatEth(before.discount)} para ${formatEth(after.discount)}.` })
  }
  if (compare(before.networkFee, after.networkFee) !== 0) {
    changes.push({ key: 'fee', text: `Taxa de rede de ${formatEth(before.networkFee)} para ${formatEth(after.networkFee)}.` })
  }
  if (compare(before.total, after.total) !== 0) {
    changes.push({ key: 'total', text: `Total de ${formatEth(before.total)} para ${formatEth(after.total)}.` })
  }
  return changes
}

export function QuoteChangedAlert({ before, after, onAccept }: { before: Quote; after: Quote; onAccept: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const changes = diffQuotes(before, after)
  const blocked = after.issues.length > 0

  useEffect(() => {
    ref.current?.focus()
  }, [after.fingerprint])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-3 rounded-sm border-2 border-brand bg-surface-dark/70 p-4 text-sm text-cream outline-none"
    >
      <p className="flex items-center gap-2 font-bold text-brand">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        {blocked ? 'A disponibilidade do seu pedido mudou' : 'Os valores do seu pedido mudaram'}
      </p>
      {changes.length > 0 && (
        <ul className="list-disc pl-5 text-sand">
          {changes.map((c) => (
            <li key={c.key}>{c.text}</li>
          ))}
        </ul>
      )}
      {blocked ? (
        <>
          <ul className="list-disc pl-5 text-danger">
            {after.issues.map((i) => (
              <li key={`${i.type}:${i.nftId}:${i.editionId}`}>{i.message}</li>
            ))}
          </ul>
          <Link to="/cart" className="self-start font-bold text-brand-accent underline underline-offset-2">
            Ajustar itens no carrinho
          </Link>
        </>
      ) : (
        <>
          <p className="text-sand">Revise os novos valores. A compra só pode ser confirmada com a cotação atualizada.</p>
          <Button type="button" onClick={onAccept} className="self-start">
            Aceitar novos valores
          </Button>
        </>
      )}
    </div>
  )
}
