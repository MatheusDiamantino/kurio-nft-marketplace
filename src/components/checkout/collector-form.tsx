import { Link } from '@tanstack/react-router'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { NETWORKS, type Wallet } from '@/api/contracts'
import { FormSelect } from '@/components/account/form-controls'
import { Field } from '@/components/shared'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { NETWORK_LABEL, WALLET_LABEL } from './wallet-picker'

export const collectorSchema = z.object({
  displayName: z.string().trim().min(1, 'Informe o nome de exibição.').max(60, 'Use até 60 caracteres.'),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]{3,30}$/i, 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.'),
  network: z.enum(NETWORKS, { message: 'Selecione uma rede.' }),
  profileName: z.string().trim().min(1, 'Informe o nome do perfil.'),
  referralCode: z.string().trim().min(1, 'Informe o código de indicação.'),
  email: z.string().trim().email('Informe um e-mail válido.'),
  ensSuffix: z.literal('.eth'),
  ensName: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{3,40}$/, 'Use de 3 a 40 letras minúsculas, números ou hífen.'),
  note: z.string().max(500, 'Use até 500 caracteres.'),
})

export type CollectorValues = z.infer<typeof collectorSchema>

const INPUT = 'h-10 border-line-soft bg-transparent text-sm placeholder:text-tan'

export function CollectorForm({
  form,
  wallet,
  hasSecondary,
  useSecondary,
  onToggleSecondary,
  disabled,
}: {
  form: UseFormReturn<CollectorValues>
  wallet: Wallet | null
  hasSecondary: boolean
  useSecondary: boolean
  onToggleSecondary: (next: boolean) => void
  disabled?: boolean
}) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-5">
      <legend className="mb-5 text-lg font-bold text-cream">Perfil do colecionador</legend>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(p) => <Input {...p} {...register('displayName')} autoComplete="name" className={INPUT} />}
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          {(p) => <Input {...p} {...register('username')} autoComplete="username" className={INPUT} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="network"
              render={({ field }) => (
                <FormSelect
                  {...p}
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={disabled}
                  placeholder="Selecione uma rede"
                  className="rounded-sm border-line-soft"
                  options={NETWORKS.map((n) => ({ value: n, label: NETWORK_LABEL[n] }))}
                />
              )}
            />
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(p) => <Input {...p} {...register('profileName')} className={INPUT} />}
        </Field>
        <Field label="Endereço da carteira" required help="Definido pela carteira selecionada.">
          {(p) => (
            <Input {...p} readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" className={cn(INPUT, 'text-sand')} />
          )}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)">
          {(p) => (
            <Input
              {...p}
              readOnly
              value={wallet?.secondaryAddress ?? ''}
              placeholder="ENS ou carteira secundária (opcional)"
              className={cn(INPUT, 'text-sand')}
            />
          )}
        </Field>
        <Field label="Tipo de carteira" required>
          {(p) => (
            <Input {...p} readOnly value={wallet ? WALLET_LABEL[wallet.kind] : ''} placeholder="Selecione uma carteira" className={cn(INPUT, 'text-sand')} />
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(p) => <Input {...p} {...register('referralCode')} className={INPUT} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(p) => <Input {...p} type="email" {...register('email')} autoComplete="email" className={INPUT} />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(p) => (
            <div className="flex gap-2.5">
              <Controller
                control={form.control}
                name="ensSuffix"
                render={({ field }) => (
                  <FormSelect
                    aria-label="Sufixo ENS"
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={disabled}
                    className="w-[78px] shrink-0 rounded-sm border-line-soft"
                    options={[{ value: '.eth', label: '.eth' }]}
                  />
                )}
              />
              <Input {...p} {...register('ensName')} className={INPUT} />
            </div>
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-1">
        <div className="inline-flex items-center gap-2">
          <Checkbox
            id="use-secondary-wallet"
            checked={useSecondary}
            disabled={!hasSecondary || disabled}
            onCheckedChange={(checked) => onToggleSecondary(checked === true)}
          />
          <Label htmlFor="use-secondary-wallet">Usar outra carteira?</Label>
        </div>
        {!hasSecondary && (
          <p className="text-xs text-tan">
            Nenhuma carteira secundária cadastrada.{' '}
            <Link to="/account/wallets" className="text-brand-accent underline underline-offset-2">
              Cadastrar carteira secundária
            </Link>
          </p>
        )}
      </div>

      <Field label="Observação do colecionador (opcional)" error={errors.note?.message} className="md:max-w-[350px]">
        {(p) => (
          <Textarea {...p} {...register('note')} rows={6} className="min-h-[150px] p-3 aria-invalid:border-danger" />
        )}
      </Field>
    </fieldset>
  )
}
