import { contextBridge, ipcRenderer } from 'electron'

const IPC = {
  CLOSE_FLOATING: 'window:close-floating',
  RELAY_STATS: 'relay:stats',
  RELAY_ERROR: 'relay:error',
  RELAY_STATS_CURRENT: 'relay:stats-current',
  APP_QUIT: 'app:quit',
  OPEN_SETTINGS: 'window:open-settings',
  MOVE_WINDOW: 'window:move-window',
  SET_RESIZABLE: 'window:set-resizable',
  STYLE_GET: 'style:get',
  STYLE_SET: 'style:set'
}

contextBridge.exposeInMainWorld('electronAPI', {
  closeFloatingWindow: (): void => ipcRenderer.send(IPC.CLOSE_FLOATING),
  quitApp: (): void => ipcRenderer.send(IPC.APP_QUIT),
  openSettings: (): void => ipcRenderer.send(IPC.OPEN_SETTINGS),
  moveWindow: (x: number, y: number): void => ipcRenderer.send(IPC.MOVE_WINDOW, x, y),
  setResizable: (resizable: boolean): void => ipcRenderer.sendSync(IPC.SET_RESIZABLE, resizable),

  getRelayStats: (): Promise<any> => ipcRenderer.invoke(IPC.RELAY_STATS_CURRENT),

  onRelayStats: (callback: (stats: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: any) => callback(stats)
    ipcRenderer.on(IPC.RELAY_STATS, handler)
    return () => ipcRenderer.removeListener(IPC.RELAY_STATS, handler)
  },
  onRelayError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on(IPC.RELAY_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.RELAY_ERROR, handler)
  },

  // Style
  getFloatingStyle: (): Promise<any> => ipcRenderer.invoke(IPC.STYLE_GET),
  onStyleUpdate: (callback: (style: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, style: any) => callback(style)
    ipcRenderer.on(IPC.STYLE_SET, handler)
    return () => ipcRenderer.removeListener(IPC.STYLE_SET, handler)
  }
})
