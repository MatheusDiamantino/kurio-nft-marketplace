import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { isApiError } from '@/api/client'
import type { Session } from '@/api/contracts'
import { useLogin, useRegister } from '@/auth/use-auth-actions'
import { FacebookIcon, GoogleIcon } from '@/components/brand-icons'
import { Field } from '@/components/shared'
import { applyServerErrors } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { PasswordInput, TextInput } from '@/components/account/form-controls'

export type AuthVariant = 'modal' | 'page'

const fieldInput = (variant: AuthVariant) =>
  variant === 'page' ? 'h-[50px] rounded-[10px] px-4 text-[15px]' : 'h-10 text-[13px] placeholder:text-[13px]'

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-sm border border-danger/60 bg-danger/10 px-3 py-2 text-xs text-danger">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

function SubmitButton({ variant, pending, label, pendingLabel }: { variant: AuthVariant; pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        'w-full bg-brand font-bold text-ink transition-colors hover:bg-brand-accent disabled:opacity-60',
        variant === 'page' ? 'h-[60px] rounded-[10px] text-base' : 'h-[45px] rounded-[2px] text-base',
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

export function SocialLogin({ variant }: { variant: AuthVariant }) {
  const notify = () => toast.info('Login social indisponível nesta demonstração.')
  const btn = cn(
    'flex h-10 w-full items-center justify-center gap-3 border border-line text-[13px] font-medium text-sand hover:border-brand hover:text-brand-accent',
    variant === 'page' ? 'rounded-[2px]' : 'rounded-[2px]',
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-[13px] text-cream" role="separator" aria-label="Ou continue com">
        <span className="h-px flex-1 bg-line" aria-hidden />
        <span aria-hidden>Ou continue com</span>
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>
      <div className={cn('flex flex-col', variant === 'page' ? 'gap-4' : 'gap-3', variant === 'modal' && 'px-20')}>
        <button type="button" className={btn} onClick={notify}>
          <GoogleIcon width={20} height={20} />
          Continuar com Google
        </button>
        <button type="button" className={btn} onClick={notify}>
          <FacebookIcon width={20} height={20} className="text-facebook" />
          Continuar com Facebook
        </button>
      </div>
    </div>
  )
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})
type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({ variant, onSuccess }: { variant: AuthVariant; onSuccess: (s: Session) => void }) {
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    
    defaultValues: { email: 'ana@kurio.dev', password: 'Kurio@123' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      const session = await login.mutateAsync(values)
      onSuccess(session)
    } catch (error) {
      if (isApiError(error) && error.code === 'INVALID_CREDENTIALS') {
        setFormError('E-mail ou senha incorretos.')
        form.setFocus('password')
        return
      }
      setFormError(applyServerErrors(form, error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex flex-col', variant === 'page' ? 'gap-5' : 'gap-3 px-20')} aria-label="Entrar">
      <FormAlert message={formError} />
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        {(p) => (
          <TextInput
            {...p}
            {...form.register('email')}
            type="email"
            autoComplete="email"
            placeholder="contato@email.com"
            className={fieldInput(variant)}
          />
        )}
      </Field>
      <Field label="Senha" error={errors.password?.message} hideLabel>
        {(p) => (
          <PasswordInput
            {...p}
            {...form.register('password')}
            autoComplete="current-password"
            placeholder="Senha"
            className={fieldInput(variant)}
          />
        )}
      </Field>
      <div className="-mt-1 flex justify-end">
        <button
          type="button"
          className="text-[13px] text-brand hover:text-brand-accent hover:underline"
          onClick={() => toast.info('Recuperação de senha indisponível nesta demonstração.')}
        >
          Esqueceu a senha?
        </button>
      </div>
      <div className={variant === 'page' ? 'mt-4' : 'mt-2'}>
        <SubmitButton variant={variant} pending={login.isPending} label="Entrar" pendingLabel="Entrando..." />
      </div>
      <p className="text-center text-[11px] text-tan">Conta demo já preenchida: ana@kurio.dev / Kurio@123 (ou bruno@kurio.dev)</p>
    </form>
  )
}

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, 'Informe um nome de usuário.')
      .regex(/^[a-z0-9._-]{3,30}$/i, 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.'),
    email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
      .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula.')
      .regex(/\d/, 'Inclua ao menos um número.'),
    confirm: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem.' })
type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm({ variant, onSuccess }: { variant: AuthVariant; onSuccess: (s: Session) => void }) {
  const register = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirm: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async ({ confirm: _c, ...values }) => {
    setFormError(null)
    try {
      const session = await register.mutateAsync(values)
      onSuccess(session)
    } catch (error) {
      const message = applyServerErrors(form, error)
      setFormError(
        isApiError(error) && (error.code === 'EMAIL_TAKEN' || error.code === 'USERNAME_TAKEN') ? error.message : message,
      )
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className={cn('flex flex-col', variant === 'page' ? 'gap-3' : 'gap-3 px-20')} aria-label="Criar conta">
      <FormAlert message={formError} />
      <Field label="Nome de usuário" error={errors.username?.message} hideLabel required>
        {(p) => (
          <TextInput
            {...p}
            {...form.register('username')}
            autoComplete="username"
            placeholder="Nome de usuário"
            className={cn(fieldInput(variant), variant === 'page' && 'text-center')}
          />
        )}
      </Field>
      <Field label="E-mail" error={errors.email?.message} hideLabel required>
        {(p) => (
          <TextInput {...p} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={fieldInput(variant)} />
        )}
      </Field>
      <Field label="Senha" error={errors.password?.message} hideLabel required help="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
        {(p) => (
          <PasswordInput {...p} {...form.register('password')} autoComplete="new-password" placeholder="Senha" className={fieldInput(variant)} />
        )}
      </Field>
      <Field label="Confirmar senha" error={errors.confirm?.message} hideLabel required>
        {(p) => (
          <PasswordInput
            {...p}
            {...form.register('confirm')}
            autoComplete="new-password"
            placeholder="Confirmar senha"
            toggleLabel="Mostrar confirmação de senha"
            className={fieldInput(variant)}
          />
        )}
      </Field>
      <div className={variant === 'page' ? 'mt-7' : 'mt-3'}>
        <SubmitButton
          variant={variant}
          pending={register.isPending}
          label={variant === 'page' ? 'Criar perfil' : 'Criar conta'}
          pendingLabel="Criando..."
        />
      </div>
    </form>
  )
}
