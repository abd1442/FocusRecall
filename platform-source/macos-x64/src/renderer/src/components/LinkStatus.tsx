import { t as uiText } from '../i18n'
import { showMessage } from './appDialogs'
import { checkLink, type LinkKind } from '@core/links'

/**
 * Under a link field: whether the link is understood ("Playlist recognised",
 * or what is wrong), and a Test button that opens it.
 */
export function LinkStatus({ value, kind }: { value: string; kind: LinkKind }): React.JSX.Element | null {
  const c = checkLink(value, kind)
  if (c.empty) return null
  return (
    <span className="flex items-center gap-3 text-sm">
      <span className={c.ok ? 'text-rest' : 'text-overtime'}>
        {c.ok ? '✓ ' : ''}
        {uiText(c.message)}
      </span>
      {c.target && (
        <button
          type="button"
          onClick={() => void window.api.invoke('shell:open', c.target!).catch((err: unknown) => void showMessage(err instanceof Error ? err.message : String(err)))}
          className="rounded-md border border-line px-2.5 py-0.5 text-sm hover:border-muted"
        >{uiText("Test")}</button>
      )}
    </span>
  )
}
