import { t as uiText } from '../i18n'
import { useState } from 'react'
import type { PickerItem } from '@core/types'
import { sessionCommand, useSettings } from '../store/session'
import { ItemPicker } from './ItemPicker'
import { Button, Dialog } from './ui'

/**
 * Switch subject during a session. The default switches straight away and
 * the session goes on; "Finish this subject first" ends the session (recall,
 * log, rest) with the chosen subject ready for the next one.
 */
export function SwitchDialog({ currentId, onClose }: { currentId: number; onClose: () => void }): React.JSX.Element {
  const quick=useSettings(s=>s.settings.studyExperience==='quick')
  const [picked, setPicked] = useState<PickerItem | null>(null)

  const cancel = (): void => {
    void window.api.invoke('ui:switchClosed')
    onClose()
  }
  const switchNow = async (item = picked): Promise<void> => {
    if (!item) return
    onClose()
    await sessionCommand(() => window.api.invoke('session:switch', item.id))
  }
  const wrapUp = async (): Promise<void> => {
    if (!picked) return
    onClose()
    await sessionCommand(() => window.api.invoke('session:wrapUp', picked.id))
  }

  return (
    <Dialog title={uiText("Switch to")} onClose={cancel}>
      <ItemPicker autoFocus excludeIds={[currentId]} selectedId={picked?.id ?? null} onSelect={setPicked} onConfirm={() => void switchNow()} />
      <p className="mt-4 text-base text-muted">{uiText("The session goes on with the same clock. Each subject keeps its own time.")}</p>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost" onClick={cancel}>{uiText("Cancel")}</Button>
        {!quick&&<Button variant="quiet" disabled={!picked} onClick={wrapUp} title={uiText("Recall and log what you did so far, rest, then start the chosen subject yourself")}>{uiText("Finish this subject first")}</Button>}
        <Button variant="primary" disabled={!picked} onClick={() => void switchNow()}>{uiText("Switch now")}</Button>
      </div>
    </Dialog>
  )
}
