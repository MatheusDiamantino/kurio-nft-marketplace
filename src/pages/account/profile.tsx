import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { useUser } from '@/auth/use-session'
import { Avatar } from '@/components/avatar'
import { EnsInput, PasswordInput, TextInput } from '@/components/account/form-controls'
import { ErrorState, Field, LiveRegion } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { applyServerErrors } from '@/lib/form-errors'
import { useChangePassword, useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from '@/queries/account'

const strong = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula.')
  .regex(/\d/, 'Inclua ao menos um número.')

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Informe o nome de exibição.').max(60, 'Use até 60 caracteres.'),
    username: z
      .string()
      .trim()
      .min(1, 'Informe o nome de usuário.')
      .regex(/^[a-z0-9._-]{3,30}$/i, 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado.'),
    email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
    ensName: z
      .string()
      .trim()
      .min(1, 'Informe o nome ENS.')
      .regex(/^[a-z0-9-]{3,40}$/, 'Use de 3 a 40 letras minúsculas, números ou hífen.'),
    walletNickname: z.string().trim().min(1, 'Informe o apelido da carteira.'),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const touched = v.currentPassword || v.newPassword || v.confirmPassword
    if (!touched) return
    if (!v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual.' })
    const r = strong.safeParse(v.newPassword)
    if (!r.success) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: r.error.issues[0].message })
    else if (v.newPassword === v.currentPassword)
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' })
    if (v.confirmPassword !== v.newPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  })

type Values = z.infer<typeof schema>

const MAX_AVATAR = 1024 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function AvatarEditor() {
  const user = useUser()
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const id = useId()
  const busy = setAvatar.isPending || removeAvatar.isPending

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!AVATAR_TYPES.includes(file.type)) return setError('Use uma imagem PNG, JPEG ou WebP.')
    if (file.size > MAX_AVATAR) return setError('A imagem deve ter até 1 MB.')
    try {
      await setAvatar.mutateAsync(await readAsDataUrl(file))
      setAnnounce('Avatar atualizado.')
      toast.success('Avatar atualizado.')
    } catch (err) {
      setError(isApiError(err) ? (Object.values(err.fields)[0] ?? err.message) : 'Não foi possível ler a imagem.')
    }
  }

  const onRemove = async () => {
    setError(null)
    try {
      await removeAvatar.mutateAsync()
      setAnnounce('Avatar removido.')
      toast.success('Avatar removido.')
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Não foi possível remover o avatar.')
    }
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-2 text-[15px] text-cream">Avatar</legend>
      <div className="flex flex-wrap items-center gap-6">
        <Avatar user={user} size={50} />
        <label htmlFor={`${id}-file`} className="sr-only">
          Arquivo de avatar
        </label>
        <input ref={fileRef} id={`${id}-file`} type="file" accept={AVATAR_TYPES.join(',')} className="sr-only" tabIndex={-1} onChange={onFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="h-10 rounded-[2px] bg-brand px-6 text-sm font-bold text-ink hover:bg-brand-accent disabled:opacity-60"
        >
          {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy || !user?.avatarUrl}
          className="h-10 px-2 text-sm text-cream hover:text-brand-accent disabled:opacity-50"
        >
          {removeAvatar.isPending ? 'Removendo…' : 'Remover'}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <LiveRegion message={announce} />
    </fieldset>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando perfil" className="grid gap-x-7 gap-y-8 md:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export function ProfilePage() {
  const profile = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Perfil do colecionador — Kurio'
  }, [])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      username: '',
      email: '',
      ensName: '',
      walletNickname: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    values: profile.data
      ? {
          displayName: profile.data.displayName,
          username: profile.data.username,
          email: profile.data.email,
          ensName: profile.data.ensName,
          walletNickname: profile.data.walletNickname,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null)
    try {
      await update.mutateAsync({
        displayName: v.displayName,
        username: v.username,
        email: v.email,
        ensName: v.ensName,
        walletNickname: v.walletNickname,
      })
    } catch (error) {
      setFormError(applyServerErrors(form, error))
      return
    }
    if (v.currentPassword || v.newPassword) {
      try {
        await changePassword.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword })
        form.resetField('currentPassword', { defaultValue: '' })
        form.resetField('newPassword', { defaultValue: '' })
        form.resetField('confirmPassword', { defaultValue: '' })
        toast.success('Perfil e senha atualizados.')
      } catch (error) {
        toast.success('Dados do perfil salvos.')
        setFormError(applyServerErrors(form, error) ?? 'A senha não foi alterada.')
      }
      return
    }
    toast.success('Dados do perfil salvos.')
  })

  return (
    <section aria-labelledby="profile-title" className="flex flex-col gap-8">
      <h1 id="profile-title" className="text-[15px] font-bold text-cream md:pt-2">
        Perfil do colecionador
      </h1>
      {profile.isPending ? (
        <ProfileSkeleton />
      ) : profile.isError ? (
        <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} retrying={profile.isRefetching} />
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8" aria-label="Dados do perfil">
          {formError && (
            <p role="alert" className="rounded-sm border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <div className="grid gap-x-7 gap-y-7 md:grid-cols-2">
            <Field label="Nome de exibição" required error={errors.displayName?.message}>
              {(p) => <TextInput {...p} {...form.register('displayName')} autoComplete="name" />}
            </Field>
            <Field label="Nome de usuário" required error={errors.username?.message}>
              {(p) => <TextInput {...p} {...form.register('username')} autoComplete="username" />}
            </Field>
            <Field label="E-mail" required error={errors.email?.message}>
              {(p) => <TextInput {...p} {...form.register('email')} type="email" autoComplete="email" />}
            </Field>
            <Field label="Nome ENS" required error={errors.ensName?.message}>
              {(p) => <EnsInput {...p} {...form.register('ensName')} autoCapitalize="none" />}
            </Field>
            <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
              {(p) => <TextInput {...p} {...form.register('walletNickname')} />}
            </Field>
            <AvatarEditor />
          </div>

          <fieldset className="flex flex-col gap-5 md:max-w-[calc(50%-14px)]">
            <legend className="mb-5 text-base font-bold text-cream">Alterar senha</legend>
            <Field label="Senha atual" error={errors.currentPassword?.message}>
              {(p) => (
                <PasswordInput {...p} {...form.register('currentPassword')} autoComplete="current-password" toggleLabel="Mostrar senha atual" />
              )}
            </Field>
            <Field label="Nova senha" error={errors.newPassword?.message} help="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
              {(p) => <PasswordInput {...p} {...form.register('newPassword')} autoComplete="new-password" toggleLabel="Mostrar nova senha" />}
            </Field>
            <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
              {(p) => (
                <PasswordInput
                  {...p}
                  {...form.register('confirmPassword')}
                  autoComplete="new-password"
                  toggleLabel="Mostrar confirmação da nova senha"
                />
              )}
            </Field>
          </fieldset>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="h-10 min-w-[131px] rounded-[2px] bg-brand px-6 text-sm font-bold text-ink hover:bg-brand-accent disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
