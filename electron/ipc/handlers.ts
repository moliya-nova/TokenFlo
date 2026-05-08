import { ipcMain, app, BrowserWindow, dialog, webUtils, screen } from 'electron'
import { IPC } from './channels'
import type { RelaySettings, FloatingStyleConfig } from '../../src/shared/relay-types'
import { PRESET_BACKGROUND_FILES } from '../../src/shared/relay-types'
import { loadRelaySettings, saveRelaySettings, readConfigs, writeConfigs, loadFloatingStyle, saveFloatingStyle, listSessionLogs } from '../relay/persistence'
import { initStats, updateSettings as updateStatsSettings, getLastModel, getStats, correctModelBalance, getCurrentRelayStats } from '../relay/stats'
import { startServer, stopServer, isServerRunning, getListeningPort, restartServer, updateModels } from '../relay/server'
import { startBalanceChecker, stopBalanceChecker } from '../relay/balance-checker'
import * as path from 'path'
import * as fs from 'fs'

export function registerHandlers(
  getFloatingWindow: () => Electron.BrowserWindow | null,
  getSettings: () => RelaySettings,
  setSettings: (s: RelaySettings) => void,
  createFloatingWindow: () => void,
  createSettingsWindow: () => void,
  getAllWindows?: () => BrowserWindow[]
): void {
  // ---- Settings ----
  ipcMain.handle(IPC.SETTINGS_GET, () => loadRelaySettings())
  ipcMain.handle(IPC.SETTINGS_SET, (_e, s: RelaySettings) => {
    saveRelaySettings(s)
    setSettings(s)
    updateModels(s.models.filter(m => m.enabled !== false))
    updateStatsSettings(s)
  })

  // ---- Relay control ----
  ipcMain.handle(IPC.RELAY_START, async (_e, settings: RelaySettings) => {
    saveRelaySettings(settings)
    setSettings(settings)
    updateModels(settings.models.filter(m => m.enabled !== false))
    const result = await restartServer(settings)
    if (result.success) {
      initStats(settings,
        (stats) => {
          const w = getFloatingWindow()
          if (w && !w.isDestroyed()) w.webContents.send(IPC.RELAY_STATS, stats)
        },
        (msg) => {
          const w = getFloatingWindow()
          if (w && !w.isDestroyed()) w.webContents.send(IPC.RELAY_ERROR, msg)
        }
      )
      startBalanceChecker(
        () => settings.models,
        (modelId, realBalance) => correctModelBalance(modelId, realBalance)
      )
    }
    return result
  })

  ipcMain.handle(IPC.RELAY_STOP, async () => {
    stopBalanceChecker()
    stopServer() // stopServer 内部已调用 pushServerState(false, 0)
  })

  ipcMain.handle(IPC.RELAY_STATUS, () => ({
    running: isServerRunning(),
    port: getListeningPort()
  }))

  ipcMain.handle(IPC.RELAY_STATS_CURRENT, () =>
    getCurrentRelayStats(isServerRunning(), getListeningPort())
  )

  // ---- Windows ----
  ipcMain.on(IPC.OPEN_FLOATING, () => createFloatingWindow())
  ipcMain.on(IPC.CLOSE_FLOATING, () => {
    const w = getFloatingWindow()
    if (w) w.close()
  })
  ipcMain.on(IPC.OPEN_SETTINGS, () => createSettingsWindow())
  ipcMain.on(IPC.MOVE_WINDOW, (_e, x: number, y: number) => {
    const w = getFloatingWindow()
    if (w && !w.isDestroyed()) w.setPosition(x, y)
  })
  ipcMain.on(IPC.SET_RESIZABLE, (e, resizable: boolean) => {
    const w = getFloatingWindow()
    if (w && !w.isDestroyed()) w.setResizable(resizable)
    e.returnValue = true
  })
  ipcMain.on(IPC.APP_QUIT, () => app.quit())

  // ---- Auto start ----
  ipcMain.handle(IPC.AUTOSTART_GET, () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle(IPC.AUTOSTART_SET, (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
  })

  // ---- Config profiles ----
  ipcMain.handle(IPC.CONFIGS_LIST, () => Object.keys(readConfigs()))
  ipcMain.handle(IPC.CONFIGS_SAVE, (_e, name: string, s: RelaySettings) => {
    const c = readConfigs()
    c[name] = s
    writeConfigs(c)
  })
  ipcMain.handle(IPC.CONFIGS_DELETE, (_e, name: string) => {
    const c = readConfigs()
    delete c[name]
    writeConfigs(c)
  })
  ipcMain.handle(IPC.CONFIGS_LOAD, (_e, name: string) => {
    const c = readConfigs()
    const s = c[name]
    if (s) {
      saveRelaySettings(s)
      setSettings(s)
      return s
    }
    return null
  })

  // ---- Style config ----
  ipcMain.handle(IPC.STYLE_GET, () => loadFloatingStyle())
  ipcMain.handle(IPC.STYLE_SET, (_e, style: FloatingStyleConfig) => {
    saveFloatingStyle(style)
    // 重新加载以解析 backgroundPreset 为 data URL
    const resolved = loadFloatingStyle()
    const windows = getAllWindows ? getAllWindows() : []
    for (const w of windows) {
      if (!w.isDestroyed()) {
        w.webContents.send(IPC.STYLE_SET, resolved)
      }
    }
  })

  // ---- Background image selection ----
  ipcMain.handle(IPC.BACKGROUND_SELECT_IMAGE, async () => {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const backgroundsDir = path.join(app.getPath('home'), '.tokenflo', 'backgrounds')
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true })
      }
      const fileName = `bg-${Date.now()}${path.extname(filePath)}`
      const destPath = path.join(backgroundsDir, fileName)
      fs.copyFileSync(filePath, destPath)
      // 返回文件名，加载时再读取
      return fileName
    }
    return null
  })

  ipcMain.handle(IPC.BACKGROUND_GET_PRESETS, () => {
    const imagesDir = path.join(app.getAppPath(), 'resources', 'images')
    return PRESET_BACKGROUND_FILES.map(filename => {
      try {
        const filePath = path.join(imagesDir, filename)
        const buffer = fs.readFileSync(filePath)
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        return { filename, dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}` }
      } catch {
        return { filename, dataUrl: '' }
      }
    })
  })

  // ---- Session logs ----
  ipcMain.handle(IPC.LOGS_LIST, () => listSessionLogs())
}
