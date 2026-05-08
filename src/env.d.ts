/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Relay types (ambient declarations for renderer)
interface ModelEntry {
  id: string
  name: string
  apiFormat: 'openai' | 'anthropic'
  apiBase: string
  apiKey: string
  inputPrice: number
  outputPrice: number
  enabled: boolean
  initialBalance: number
  alertThreshold: number
  balanceQueryUrl?: string
  balanceQueryKey?: string
}

interface RelaySettings {
  port: number
  models: ModelEntry[]
  windowWidth: number
  windowHeight: number
  windowX: number
  windowY: number
  autoStart: boolean
}

interface RelayStats {
  sessionTokens: number
  sessionCost: number
  todayTokens: number
  todayCost: number
  lastModel: string
  timestamp: number
  serverRunning: boolean
  serverPort: number
  modelStats: Record<string, { tokens: number; cost: number; balance: number; name: string }>
  alerts?: string[]
}

interface FloatingStyleConfig {
  backgroundColor: string
  backgroundOpacity: number
  backgroundType: 'solid' | 'image'
  backgroundImage: string
  backgroundPreset: string
  backgroundImageOpacity: number
  backgroundImageBlur: number
  fontFamily: string
  fontSize: number
  tokenNumberColor: string
  timeColor: string
  sessionCostColor: string
  balanceColor: string
  modelNameColor: string
  modelTokensColor: string
  modelCostColor: string
  modelBalanceColor: string
  alertColor: string
  borderColor: string
  borderOpacity: number
  labelColor: string
}

interface SessionLogEntry {
  filename: string
  timestamp: string
  date: string
  time: string
  models: {
    name: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
    balance: number
  }[]
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCost: number
}

interface ElectronAPI {
  // Settings
  getSettings: () => Promise<RelaySettings>
  setSettings: (settings: RelaySettings) => Promise<void>
  openFloatingWindow: () => void
  openSettingsWindow: () => void
  getAutoStart: () => Promise<boolean>
  setAutoStart: (enabled: boolean) => Promise<void>

  // Relay control
  startRelay: (settings: RelaySettings) => Promise<{ success: boolean; port: number; error?: string }>
  stopRelay: () => Promise<void>
  getRelayStatus: () => Promise<{ running: boolean; port: number }>

  // Floating window
  closeFloatingWindow: () => void
  quitApp: () => void
  moveWindow: (x: number, y: number) => void
  setResizable: (resizable: boolean) => void
  getRelayStats: () => Promise<RelayStats>
  onRelayStats: (callback: (stats: RelayStats) => void) => () => void
  onRelayError: (callback: (error: string) => void) => () => void

  // Saved configs
  listConfigs: () => Promise<string[]>
  saveConfig: (name: string, settings: RelaySettings) => Promise<void>
  deleteConfig: (name: string) => Promise<void>
  loadConfig: (name: string) => Promise<RelaySettings | null>

  // Style config
  getFloatingStyle: () => Promise<FloatingStyleConfig>
  setFloatingStyle: (style: FloatingStyleConfig) => Promise<void>
  onStyleUpdate: (callback: (style: FloatingStyleConfig) => void) => () => void

  // Background
  selectBackgroundImage: () => Promise<{ filename: string; dataUrl: string } | null>
  getPresetBackgrounds: () => Promise<{ filename: string; dataUrl: string }[]>

  // Themes
  listThemes: () => Promise<string[]>
  saveTheme: (name: string, style: FloatingStyleConfig) => Promise<void>
  deleteTheme: (name: string) => Promise<void>
  loadTheme: (name: string) => Promise<FloatingStyleConfig | null>

  // Session logs
  listSessionLogs: () => Promise<SessionLogEntry[]>
}

interface Window {
  electronAPI: ElectronAPI
}
