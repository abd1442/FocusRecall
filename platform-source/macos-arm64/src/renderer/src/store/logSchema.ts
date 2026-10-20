import { create } from 'zustand'
import type { LogSchema } from '@core/logfields'

/** The log's groups, fields and options. Main broadcasts every change. */
export const useLogSchema = create<{ schema: LogSchema; loaded: boolean }>(() => ({
  schema: { groups: [], fields: [] },
  loaded: false
}))

// Imported by preparation in auxiliary windows too. Their existing IPC role
// deliberately excludes the full log schema; do not issue a forbidden request.
if (!['#panel', '#reasons', '#capture'].includes(window.location.hash)) {
void window.api.invoke('log:schema').then((schema) => useLogSchema.setState({ schema, loaded: true }))
window.api.on('log:schemaChanged', (schema) => useLogSchema.setState({ schema, loaded: true }))
}
