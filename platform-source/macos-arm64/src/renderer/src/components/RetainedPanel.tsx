import { memo, type ReactNode } from 'react'

/** Mount on first visit, retaining drafts and selections between visits. Hidden
 * content keeps its last props/context snapshot instead of recalculating every
 * section after a filter change. Global store subscriptions still work. */
const RetainedContent = memo(
  ({ active, children }: { active: boolean; children: ReactNode }) => active ? children : null,
  (_previous, next) => !next.active
)

export function RetainedPanel({ active, children }: { active: boolean; children: ReactNode }): React.JSX.Element {
  return <div hidden={!active}><RetainedContent active={active}>{children}</RetainedContent></div>
}
