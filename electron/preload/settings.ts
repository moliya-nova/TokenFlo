import { contextBridge, ipcRenderer } from 'electron'

const IPC = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  OPEN_FLOATING: 'window:open-floating',
  OPEN_SETTINGS: 'window:open-settings',
  AUTOSTART_GET: 'autostart:get',
  AUTOSTART_SET: 'autostart:set',
  CONFIGS_LIST: 'configs:list',
  CONFIGS_SAVE: 'configs:save',
  CONFIGS_DELETE: 'configs:delete',
  CONFIGS_LOAD: 'configs:load',
  RELAY_START: 'relay:start',
  RELAY_STOP: 'relay:stop',
  RELAY_STATUS: 'relay:status',
  STYLE_GET: 'style:get',
  STYLE_SET: 'style:set',
  BACKGROUND_SELECT_IMAGE: 'background:select-image',
  LOGS_LIST: 'logs:list'
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: (): Promise<any> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (settings: any): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SET, settings),

  // Relay control
  startRelay: (settings: any): Promise<{ success: boolean; port: number; error?: string }> =>
    ipcRenderer.invoke(IPC.RELAY_START, settings),
  stopRelay: (): Promise<void> => ipcRenderer.invoke(IPC.RELAY_STOP),
  getRelayStatus: (): Promise<{ running: boolean; port: number }> =>
    ipcRenderer.invoke(IPC.RELAY_STATUS),

  // Windows
  openFloatingWindow: (): void => ipcRenderer.send(IPC.OPEN_FLOATING),
  openSettingsWindow: (): void => ipcRenderer.send(IPC.OPEN_SETTINGS),

  // Auto start
  getAutoStart: (): Promise<boolean> => ipcRenderer.invoke(IPC.AUTOSTART_GET),
  setAutoStart: (enabled: boolean): Promise<void> => ipcRenderer.invoke(IPC.AUTOSTART_SET, enabled),

  // Config profiles
  listConfigs: (): Promise<string[]> => ipcRenderer.invoke(IPC.CONFIGS_LIST),
  saveConfig: (name: string, settings: any): Promise<void> =>
    ipcRenderer.invoke(IPC.CONFIGS_SAVE, name, settings),
  deleteConfig: (name: string): Promise<void> => ipcRenderer.invoke(IPC.CONFIGS_DELETE, name),
  loadConfig: (name: string): Promise<any> => ipcRenderer.invoke(IPC.CONFIGS_LOAD, name),

  // Style config
  getFloatingStyle: (): Promise<any> => ipcRenderer.invoke(IPC.STYLE_GET),
  setFloatingStyle: (style: any): Promise<void> => ipcRenderer.invoke(IPC.STYLE_SET, style),
  onStyleUpdate: (callback: (style: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, style: any) => callback(style)
    ipcRenderer.on(IPC.STYLE_SET, handler)
    return () => ipcRenderer.removeListener(IPC.STYLE_SET, handler)
  },

  // Background image
  selectBackgroundImage: (): Promise<string | null> => ipcRenderer.invoke(IPC.BACKGROUND_SELECT_IMAGE),

  // Session logs
  listSessionLogs: (): Promise<any[]> => ipcRenderer.invoke(IPC.LOGS_LIST)
})
