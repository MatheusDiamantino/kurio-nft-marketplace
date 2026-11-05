import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { NETWORKS, WALLET_KINDS, type UpsertWalletRequest, type Wallet, type WalletSlot } from '@/api/contracts'
import { EnsInput, NativeSelect, TextInput } from '@/components/account/form-controls'
import { Field } from '@/components/shared'
import { applyServerErrors } from '@/lib/form-errors'
import { useUpsertWallet } from '@/queries/account'

const NETWORK_OPTIONS: Record<(typeof NETWORKS)[number], string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
const KIND_OPTIONS: Record<(typeof WALLET_KINDS)[number], string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const schema = z.object({
  displayName: z.string().trim().min(1, 'Informe o nome de exibição.'),
  nickname: z.string().trim().min(1, 'Informe o apelido da carteira.'),
  network: z.union([z.enum(NETWORKS), z.literal('')]).refine((v) => v !== '', 'Selecione uma rede.'),
  profileName: z.string().trim().min(1, 'Informe o nome do perfil.'),
  address: z.string().trim().min(1, 'Informe o endereço da carteira.').regex(ADDRESS_RE, 'Use um endereço 0x com 40 caracteres hexadecimais.'),
  secondaryAddress: z
    .string()
    .trim()
    .refine((v) => !v || ADDRESS_RE.test(v) || /\.eth$/.test(v), 'Use um endereço 0x válido ou um nome .eth.'),
  kind: z.union([z.enum(WALLET_KINDS), z.literal('')]).refine((v) => v !== '', 'Selecione o tipo de carteira.'),
  referralCode: z.string().trim().min(1, 'Informe o código de indicação.'),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
  ensName: z
    .string()
    .trim()
    .min(1, 'Informe o nome ENS.')
    .regex(/^[a-z0-9-]{3,40}$/, 'Use de 3 a 40 letras minúsculas, números ou hífen.'),
})

type Values = z.input<typeof schema>

const EMPTY: Values = {
  displayName: '',
  nickname: '',
  network: '',
  profileName: '',
  address: '',
  secondaryAddress: '',
  kind: '',
  referralCode: '',
  email: '',
  ensName: '',
}

function toValues(w: Wallet | undefined): Values | undefined {
  if (!w) return undefined
  return {
    displayName: w.displayName,
    nickname: w.nickname,
    network: w.network,
    profileName: w.profileName,
    address: w.address,
    secondaryAddress: w.secondaryAddress,
    kind: w.kind,
    referralCode: w.referralCode,
    email: w.email,
    ensName: w.ensName,
  }
}

export function WalletForm({
  slot,
  wallet,
  copyFrom,
  idPrefix,
}: {
  slot: WalletSlot
  wallet?: Wallet
  /** When set, the form mirrors these values (the "Igual à carteira principal" option). */
  copyFrom?: Wallet
  idPrefix: string
}) {
  const upsert = useUpsertWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
    values: toValues(wallet),
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    const v = toValues(copyFrom)
    if (!v) return
    for (const [k, val] of Object.entries(v)) form.setValue(k as keyof Values, val, { shouldDirty: true, shouldValidate: false })
    form.clearErrors()
  }, [copyFrom, form])

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null)
    try {
      await upsert.mutateAsync({ slot, body: v as UpsertWalletRequest })
      toast.success(slot === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
    } catch (error) {
      setFormError(applyServerErrors(form, error))
    }
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'}
      className="flex flex-col gap-8"
      id={`${idPrefix}-form`}
    >
      {formError && (
        <p role="alert" className="rounded-sm border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(p) => <TextInput {...p} {...form.register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          {(p) => <TextInput {...p} {...form.register('nickname')} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(p) => (
            <NativeSelect {...p} {...form.register('network')}>
              <option value="">Selecione uma rede</option>
              {NETWORKS.map((n) => (
                <option key={n} value={n}>
                  {NETWORK_OPTIONS[n]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(p) => <TextInput {...p} {...form.register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          {(p) => (
            <TextInput {...p} {...form.register('address')} placeholder="Endereço 0x da carteira" autoCapitalize="none" spellCheck={false} />
          )}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" hideLabel error={errors.secondaryAddress?.message} className="md:justify-end">
          {(p) => (
            <TextInput
              {...p}
              {...form.register('secondaryAddress')}
              placeholder="ENS ou carteira secundária (opcional)"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </Field>
        <Field label="Tipo de carteira" required error={errors.kind?.message}>
          {(p) => (
            <NativeSelect {...p} {...form.register('kind')}>
              <option value="">Selecione uma carteira</option>
              {WALLET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_OPTIONS[k]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(p) => <TextInput {...p} {...form.register('referralCode')} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(p) => <TextInput {...p} {...form.register('email')} type="email" autoComplete="email" />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(p) => <EnsInput {...p} {...form.register('ensName')} autoCapitalize="none" />}
        </Field>
      </div>
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="h-10 rounded-[2px] bg-brand px-1 text-sm font-bold text-ink hover:bg-brand-accent disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar carteira'}
        </button>
      </div>
    </form>
  )
}
