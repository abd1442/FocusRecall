import { t as uiText , currentLanguage , formatDate } from '../i18n'
// Shared building blocks so every screen uses the same tokens and sizes.
// Sizes: body 16px, nothing below 14px, hit targets at least 44px tall.
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'


/** Input styling without a width; pair it with an explicit width class. */
export const inputBase =
  'min-h-11 rounded-lg border border-line-strong bg-surface-2/60 px-4 py-2.5 [[data-theme=light]_&]:bg-surface text-base text-ink placeholder:text-faint outline-none focus:border-ring focus:bg-surface'

/** Full-width input styling. */
export const inputClass = `${inputBase} w-full`

export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted">{uiText(label)}</span>
      {children}
      {hint && <span className="text-sm text-muted">{uiText(hint)}</span>}
    </label>
  )
}

type ButtonVariant = 'primary' | 'quiet' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'quiet',
  size = 'md',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }): React.JSX.Element {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-accent text-on-accent font-semibold enabled:hover:bg-accent-hover enabled:active:bg-accent-pressed',
    quiet: 'bg-surface-2 text-ink hover:brightness-110',
    ghost: 'text-muted hover:text-ink hover:bg-surface-2',
    danger: 'text-overtime hover:bg-surface-2'
  }
  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3.5 text-sm gap-1.5',
    md: 'min-h-11 px-5 text-base gap-2',
    lg: 'min-h-16 px-10 text-xl gap-3'
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-40 ${sizes[size]} ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md'
}: {
  value: T
  options: { value: T; label: string; disabled?: boolean; title?: string }[]
  onChange: (v: T) => void
  size?: 'md' | 'lg'
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          title={o.title ? uiText(o.title) : undefined}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md transition disabled:opacity-40 ${size === 'lg' ? 'min-h-12 px-6 text-lg' : 'min-h-10 px-4 text-base'} ${
            value === o.value ? 'bg-selected text-selected-ink shadow-sm ring-1 ring-selected-line' : 'text-muted hover:text-ink'
          }`}
        >
          {uiText(o.label)}
        </button>
      ))}
    </div>
  )
}

/**
 * A centred dialog. Escape or a click outside closes it. Every dialog has the
 * same comfortable width (forms inside use two columns where they fit).
 */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const node = dialog.current!, previous = document.activeElement as HTMLElement | null
    node.showModal()
    node.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled),textarea:not(:disabled),select:not(:disabled)')?.focus()
    return () => { node.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return createPortal(
    <dialog ref={dialog} aria-modal="true" aria-labelledby={titleId}
      className="app-form-dialog m-auto max-h-[calc(100vh/var(--tf-zoom,1)-3rem)] w-[min(56rem,calc(100vw/var(--tf-zoom,1)-3rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-8 text-ink shadow-2xl"
      onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose() }}
      onClick={e => { if(e.target === e.currentTarget) { const box=e.currentTarget.getBoundingClientRect(); if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onClose() } }}>
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="mb-6 text-2xl font-semibold">{title}</h2>
        <button type="button" aria-label={uiText("Close {value0}", {value0: (title)})} className="min-h-11 min-w-11 rounded-lg border border-line" onClick={onClose}>×</button>
      </div>
        {children}
    </dialog>, document.body
  )
}

/** A small "⋯" menu for tile options. Closes on outside click or Escape. */
export { Menu } from './Menu'

/** "1 h 20 min", "Today", "3 days ago" style helpers for tiles. */
export function relativeDay(iso: string | null): string {
  if (!iso) return uiText('Not studied yet')
  const then = new Date(iso)
  const now = new Date()
  const startOf = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000)
  if (days <= 0) return uiText('Today')
  if (days === 1) return uiText('Yesterday')
  if (days < 7) return new Intl.RelativeTimeFormat(currentLanguage(), {numeric: 'auto'}).format(-days, 'day')
  return formatDate(then)
}

/** "Last studied today", "… 3 days ago", "… on 4 Oct". */
export function lastStudied(iso: string | null): string {
  return iso ? uiText('Last studied: {when}', {when: relativeDay(iso)}) : relativeDay(iso)
}
