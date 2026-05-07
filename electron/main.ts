import { app, BrowserWindow, Tray, Menu, screen } from 'electron'
import { join } from 'path'
import { IPC } from './ipc/channels'
import { registerHandlers } from './ipc/handlers'
import { loadRelaySettings, saveRelaySettings } from './relay/persistence'
import { initStats, flushSessionLog, getLastModel, pushServerState, correctModelBalance } from './relay/stats'
import { startServer, stopServer, restartServer, isServerRunning, getListeningPort, updateModels } from './relay/server'
import { startBalanceChecker, stopBalanceChecker } from './relay/balance-checker'
import type { RelaySettings, RelayStats } from '../src/shared/relay-types'

let settingsWindow: BrowserWindow | null = null
let floatingWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentSettings: RelaySettings

// ============================================================
// Floating Window
// ============================================================

function createFloatingWindow(): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) { floatingWindow.show(); floatingWindow.focus(); return }

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  let x = currentSettings.windowX, y = currentSettings.windowY
  if (x < 0 || x > screenW - 100) x = screenW - currentSettings.windowWidth - 20
  if (y < 0 || y > screenH - 100) y = 60

  floatingWindow = new BrowserWindow({
    width: currentSettings.windowWidth,
    height: currentSettings.windowHeight,
    x, y,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    maximizable: false,
    transparent: true,
    thickFrame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/floating.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    floatingWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/windows/floating/index.html`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/windows/floating/index.html'))
  }

  // 推送初始状态
  const running = isServerRunning()
  const port = getListeningPort()
  pushServerState(running, port)

  // close 事件在窗口销毁前触发，可安全获取 bounds
  floatingWindow.on('close', () => {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      const bounds = floatingWindow.getBounds()
      currentSettings.windowX = bounds.x
      currentSettings.windowY = bounds.y
      currentSettings.windowWidth = bounds.width
      currentSettings.windowHeight = bounds.height
      saveRelaySettings(currentSettings)
    }
  })

  // closed 事件在窗口销毁后触发，仅做清理
  floatingWindow.on('closed', () => {
    const logPath = flushSessionLog()
    if (logPath) console.log(`[Main] Session log saved: ${logPath}`)
    floatingWindow = null
  })
}

// ============================================================
// Settings Window
// ============================================================

function createSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return }
  settingsWindow = new BrowserWindow({
    width: 520, height: 680, resizable: false,
    title: 'Token 中转网关 - 设置',
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/windows/settings/index.html`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/windows/settings/index.html'))
  }
  settingsWindow.on('closed', () => { settingsWindow = null })
}

// ============================================================
// System Tray
// ============================================================

function createTray(): void {
  const { nativeImage } = require('electron')
  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALUlEQVR4nGNgGJTAa8LN/9gw2RqJNogiA4jVjNOQUQOoYMDApwNiDCKocUAAAHhaTkg8peJbAAAAAElFTkSuQmCC'
  )
  tray = new Tray(trayIcon)
  tray.setToolTip('Token 中转网关')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '设置', click: () => createSettingsWindow() },
    {
      label: '关闭悬浮窗',
      click: () => { if (floatingWindow && !floatingWindow.isDestroyed()) floatingWindow.close() }
    },
    { type: 'separator' },
    {
      label: '重启中转服务',
      click: async () => {
        currentSettings = loadRelaySettings()
        stopBalanceChecker()
        await restartServer(currentSettings)
        startBalanceChecker(
          () => currentSettings.models,
          (modelId, realBalance) => correctModelBalance(modelId, realBalance)
        )
        if (floatingWindow && !floatingWindow.isDestroyed()) {
          pushServerState(isServerRunning(), getListeningPort())
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { stopBalanceChecker(); stopServer(); app.quit() } }
  ]))
  tray.on('double-click', () => createSettingsWindow())
}

// ============================================================
// Stats → Floating window push callback
// ============================================================

function pushStatsToFloating(stats: RelayStats): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send(IPC.RELAY_STATS, stats)
  }
}

function pushErrorToFloating(error: string): void {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send(IPC.RELAY_ERROR, error)
  }
}

// ============================================================
// App Startup
// ============================================================

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  // 加载配置
  currentSettings = loadRelaySettings()

  // 创建托盘
  createTray()

  // 初始化统计引擎（stats 模块负责恢复历史数据）
  initStats(currentSettings, pushStatsToFloating, pushErrorToFloating)

  // 启动 HTTP 中转服务
  if (currentSettings.models.length > 0) {
    await startServer(currentSettings)
    // 启动余额查询器
    startBalanceChecker(
      () => currentSettings.models,
      (modelId, realBalance) => correctModelBalance(modelId, realBalance)
    )
  }

  // 注册 IPC handlers（需要 floating window 引用和 settings 引用）
  registerHandlers(
    () => floatingWindow,
    () => currentSettings,
    (s) => { currentSettings = s },
    createFloatingWindow,
    createSettingsWindow,
    () => BrowserWindow.getAllWindows()
  )

  // 非隐藏模式：打开设置窗口
  if (!process.argv.includes('--hidden')) {
    createSettingsWindow()
  }
})

app.on('window-all-closed', () => { /* 保持托盘运行 */ })
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createSettingsWindow()
})
app.on('before-quit', () => {
  const logPath = flushSessionLog()
  if (logPath) console.log(`[Main] Session log saved on quit: ${logPath}`)
  stopBalanceChecker()
  stopServer()
})
