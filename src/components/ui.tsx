import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { clsx } from '../lib/utils'

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg md:border-x md:border-line', className)}>
      {children}
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={clsx('flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4', className)}>{children}</main>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-3xl border border-line bg-card shadow-[var(--shadow)]', className)}>
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-accent-fg hover:opacity-90',
    secondary: 'border border-line bg-surface text-fg hover:bg-line',
    ghost: 'bg-transparent text-fg hover:bg-surface',
    danger: 'bg-danger text-white hover:opacity-90',
    success: 'bg-success text-white hover:opacity-90',
  }

  return (
    <button
      type="button"
      className={clsx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-[16px] text-fg outline-none placeholder:text-muted/70 focus:border-accent',
        props.className,
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'min-h-36 w-full resize-y rounded-2xl border border-line bg-card px-4 py-3 text-[16px] text-fg outline-none placeholder:text-muted/70 focus:border-accent',
        props.className,
      )}
    />
  )
}

export function IconButton({
  children,
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(
        'inline-flex size-11 items-center justify-center rounded-2xl text-fg transition hover:bg-surface active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <Card className="px-6 py-10 text-center">
      <h2 className="font-display text-2xl text-fg">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  )
}
