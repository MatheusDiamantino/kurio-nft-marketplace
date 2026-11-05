import { ImageIcon } from 'lucide-react'
import type { User } from '@/api/contracts'
import { cn } from '@/lib/utils'

export function Avatar({ user, size = 40, className }: { user: Pick<User, 'avatarUrl' | 'displayName'> | null; size?: number; className?: string }) {
  const style = { width: size, height: size }
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`Avatar de ${user.displayName}`}
        width={size}
        height={size}
        style={style}
        className={cn('shrink-0 rounded-full border border-line-soft object-cover', className)}
      />
    )
  }
  return (
    <span
      style={style}
      className={cn('grid shrink-0 place-items-center rounded-full border border-line-soft bg-surface-dark text-brand', className)}
      aria-hidden
    >
      <ImageIcon className="size-1/2" />
    </span>
  )
}
