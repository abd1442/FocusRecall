import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { FocusRecallApi } from '@core/api'
import { IPC_EVENTS, validateIpcArgs } from '@core/ipcValidation'

const api: FocusRecallApi = {
  invoke: (channel, ...args) => { validateIpcArgs(channel,args); return ipcRenderer.invoke(channel, ...args) },
  on: (event, listener) => {
    if(!IPC_EVENTS.includes(event)||typeof listener!=='function')throw Error('Unknown IPC event.')
    const wrapped = (_e: IpcRendererEvent, payload: unknown): void => listener(payload as never)
    ipcRenderer.on(event, wrapped)
    return () => ipcRenderer.removeListener(event, wrapped)
  }
}

contextBridge.exposeInMainWorld('api', api)
