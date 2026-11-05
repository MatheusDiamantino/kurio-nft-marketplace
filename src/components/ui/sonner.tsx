import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      mobileOffset={{ top: 84 }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'font-sans !bg-surface !text-cream !border-line-soft',
          description: '!text-sand',
          actionButton: '!bg-brand !text-ink',
        },
      }}
      {...props}
    />
  )
}
