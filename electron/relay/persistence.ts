import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { app } from 'electron'
import type { RelaySettings, ModelDailyData, HistoricalData, ModelEntry, FloatingStyleConfig, DailyData, DailySession, DailySessionModel } from '../../src/shared/relay-types'
import { DEFAULT_RELAY_SETTINGS, DEFAULT_FLOATING_STYLE } from '../../src/shared/relay-types'

const DATA_DIR = join(homedir(), '.tokenflo')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function getSettingsPath(): string { ensureDir(DATA_DIR); return join(DATA_DIR, 'settings.json') }
function getDataDir(): string { const d = join(DATA_DIR, 'data'); ensureDir(d); return d }
function getHistoricalPath(): string { return join(getDataDir(), 'historical.json') }

/** 获取某模型的数据目录，自动创建 */
function getModelDataDir(modelId: string): string {
  const d = join(getDataDir(), modelId)
  ensureDir(d)
  return d
}

// ============================================================
// Relay Settings 持久化（含旧格式迁移）
// ============================================================

export function loadRelaySettings(): RelaySettings {
  try {
    const raw = readFileSync(getSettingsPath(), 'utf-8')
    const saved = JSON.parse(raw)
    return migrateSettings(saved)
  } catch {
    return { ...DEFAULT_RELAY_SETTINGS }
  }
}

/** 将旧格式配置迁移到新格式 */
function migrateSettings(raw: any): RelaySettings {
  const hasOldGlobalFields = 'initialBalance' in raw || 'alertThreshold' in raw
  const oldInitialBalance = raw.initialBalance ?? 100
  const oldAlertThreshold = raw.alertThreshold ?? 10

  let models: ModelEntry[] = []
  if (Array.isArray(raw.models)) {
    models = raw.models.map((m: any) => {
      const migrated: ModelEntry = {
        id: m.id || '',
        name: m.name || m.id || '',
        apiFormat: m.apiFormat || 'openai',
        apiBase: m.apiBase || '',
        apiKey: m.apiKey || '',
        inputPrice: m.inputPrice ?? 0,
        outputPrice: m.outputPrice ?? 0,
        enabled: m.enabled !== false,
        initialBalance: m.initialBalance ?? (hasOldGlobalFields ? oldInitialBalance : 0),
        alertThreshold: m.alertThreshold ?? (hasOldGlobalFields ? oldAlertThreshold : 0),
        balanceQueryUrl: m.balanceQueryUrl || undefined,
        balanceQueryKey: m.balanceQueryKey || undefined
      }
      // 删除旧字段
      delete (migrated as any).provider
      return migrated
    })
  }

  return {
    port: raw.port ?? DEFAULT_RELAY_SETTINGS.port,
    models,
    windowWidth: raw.windowWidth ?? DEFAULT_RELAY_SETTINGS.windowWidth,
    windowHeight: raw.windowHeight ?? DEFAULT_RELAY_SETTINGS.windowHeight,
    windowX: raw.windowX ?? DEFAULT_RELAY_SETTINGS.windowX,
    windowY: raw.windowY ?? DEFAULT_RELAY_SETTINGS.windowY,
    autoStart: raw.autoStart ?? DEFAULT_RELAY_SETTINGS.autoStart
  }
}

export function saveRelaySettings(s: RelaySettings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), 'utf-8')
}

// ============================================================
// Session 日志 — Markdown 格式
// ============================================================

function formatCost(price: number): string {
  return '¥' + price.toFixed(6)
}

function formatTokens(n: number): string {
  return n.toLocaleString()
}

export function saveSessionLog(
  modelStats: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; cost: number; balance: number }>,
  settings: RelaySettings
): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const filename = `${ts}.md`
  const filepath = join(getDataDir(), filename)

  const modelEntries = Object.entries(modelStats)
  if (modelEntries.length === 0) return filepath

  let totalPrompt = 0, totalCompletion = 0, totalTokens = 0, totalCost = 0

  let md = `# Token 用量记录 - ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}\n\n`
  md += '| 模型 | 输入 Tokens | 输出 Tokens | 总计 Tokens | 消费金额 | 剩余余额 |\n'
  md += '|------|------------|------------|------------|----------|----------|\n'

  for (const [modelId, dailyStats] of modelEntries) {
    const modelConfig = settings.models.find(m => m.id === modelId)
    const displayName = modelConfig?.name || modelId
    md += `| ${displayName} | ${formatTokens(dailyStats.promptTokens)} | ${formatTokens(dailyStats.completionTokens)} | ${formatTokens(dailyStats.totalTokens)} | ${formatCost(dailyStats.cost)} | ${formatCost(Math.max(0, dailyStats.balance))} |\n`
    totalPrompt += dailyStats.promptTokens
    totalCompletion += dailyStats.completionTokens
    totalTokens += dailyStats.totalTokens
    totalCost += dailyStats.cost
  }

  md += `| **合计** | **${formatTokens(totalPrompt)}** | **${formatTokens(totalCompletion)}** | **${formatTokens(totalTokens)}** | **${formatCost(totalCost)}** | |\n`

  writeFileSync(filepath, md, 'utf-8')
  return filepath
}

// ============================================================
// 每模型每日数据
// ============================================================

export function loadModelDaily(modelId: string, date: string): ModelDailyData | null {
  try {
    const filepath = join(getModelDataDir(modelId), `${date}.json`)
    const raw = readFileSync(filepath, 'utf-8')
    return JSON.parse(raw) as ModelDailyData
  } catch {
    return null
  }
}

export function saveModelDaily(modelId: string, date: string, data: ModelDailyData): void {
  const filepath = join(getModelDataDir(modelId), `${date}.json`)
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

// ============================================================
// 每日聚合数据（新格式：一天一个文件）
// ============================================================

function getDailyPath(date: string): string {
  return join(getDataDir(), `${date}.json`)
}

export function loadDailyData(date: string): DailyData | null {
  try {
    const filepath = getDailyPath(date)
    const raw = readFileSync(filepath, 'utf-8')
    return JSON.parse(raw) as DailyData
  } catch {
    return null
  }
}

export function saveDailyData(data: DailyData): void {
  const filepath = getDailyPath(data.date)
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

/** 迁移旧格式数据（按模型子目录）到新格式（一天一个文件） */
export function migrateOldDailyData(): void {
  const dataDir = getDataDir()
  const markerPath = join(dataDir, '.migrated')
  if (existsSync(markerPath)) return

  try {
    const entries = readdirSync(dataDir, { withFileTypes: true })
    const modelDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'))

    // 收集所有日期 -> { modelId -> ModelDailyData }
    const dateMap = new Map<string, Map<string, ModelDailyData>>()

    for (const dir of modelDirs) {
      const modelId = dir.name
      const modelDir = join(dataDir, modelId)
      try {
        const files = readdirSync(modelDir).filter(f => f.endsWith('.json'))
        for (const file of files) {
          const date = file.replace('.json', '')
          try {
            const raw = readFileSync(join(modelDir, file), 'utf-8')
            const daily = JSON.parse(raw) as ModelDailyData
            if (!dateMap.has(date)) dateMap.set(date, new Map())
            dateMap.get(date)!.set(modelId, daily)
          } catch {
            // skip corrupted file
          }
        }
      } catch {
        // skip unreadable dir
      }
    }

    // 写入新格式
    for (const [date, modelMap] of dateMap) {
      const dailyData: DailyData = {
        date,
        sessions: [],
        dailyTotalTokens: 0,
        dailyTotalCost: 0
      }

      // 将旧数据合并为一个 session
      const sessionModels: Record<string, DailySessionModel> = {}
      let totalTokens = 0
      let totalCost = 0

      for (const [modelId, daily] of modelMap) {
        sessionModels[modelId] = {
          modelId,
          modelName: modelId,
          promptTokens: daily.promptTokens,
          completionTokens: daily.completionTokens,
          totalTokens: daily.totalTokens,
          cost: daily.cost
        }
        totalTokens += daily.totalTokens
        totalCost += daily.cost
      }

      dailyData.sessions.push({
        startTime: `${date}T00:00:00`,
        endTime: `${date}T23:59:59`,
        models: sessionModels,
        totalTokens,
        totalCost
      })
      dailyData.dailyTotalTokens = totalTokens
      dailyData.dailyTotalCost = totalCost

      saveDailyData(dailyData)
    }

    // 删除旧的模型子目录
    for (const dir of modelDirs) {
      const modelDir = join(dataDir, dir.name)
      try {
        const files = readdirSync(modelDir)
        for (const file of files) {
          unlinkSync(join(modelDir, file))
        }
        rmdirSync(modelDir)
      } catch {
        // ignore cleanup errors
      }
    }

    // 写入迁移标记
    writeFileSync(markerPath, new Date().toISOString(), 'utf-8')
  } catch {
    // migration failure is non-fatal
  }
}

export function getTodayDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ============================================================
// 历史总计
// ============================================================

export function loadHistoricalData(): HistoricalData {
  try {
    const raw = readFileSync(getHistoricalPath(), 'utf-8')
    const data = JSON.parse(raw) as HistoricalData
    return {
      totalPromptTokens: data.totalPromptTokens || 0,
      totalCompletionTokens: data.totalCompletionTokens || 0,
      totalTokens: data.totalTokens || 0,
      totalCost: data.totalCost || 0,
      modelCosts: data.modelCosts || {}
    }
  } catch {
    return { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0, modelCosts: {} }
  }
}

export function saveHistoricalData(data: HistoricalData): void {
  writeFileSync(getHistoricalPath(), JSON.stringify(data, null, 2), 'utf-8')
}

// ============================================================
// Configs 管理
// ============================================================

function getConfigsPath(): string { ensureDir(DATA_DIR); return join(DATA_DIR, 'configs.json') }

export function readConfigs(): Record<string, RelaySettings> {
  try { return JSON.parse(readFileSync(getConfigsPath(), 'utf-8')) } catch { return {} }
}

export function writeConfigs(c: Record<string, RelaySettings>): void {
  writeFileSync(getConfigsPath(), JSON.stringify(c, null, 2), 'utf-8')
}

// ============================================================
// 样式配置持久化
// ============================================================

function getStylePath(): string { ensureDir(DATA_DIR); return join(DATA_DIR, 'style.json') }
function getBackgroundsDir(): string { const d = join(DATA_DIR, 'backgrounds'); ensureDir(d); return d }

export function loadFloatingStyle(): FloatingStyleConfig {
  try {
    const raw = readFileSync(getStylePath(), 'utf-8')
    const saved = JSON.parse(raw)

    // 迁移旧背景类型
    if (!['solid', 'image'].includes(saved.backgroundType)) {
      saved.backgroundType = 'solid'
    }

    // 处理预设图片
    if (saved.backgroundType === 'image' && saved.backgroundPreset) {
      const presetPath = join(app.getAppPath(), 'resources', 'images', saved.backgroundPreset)
      if (existsSync(presetPath)) {
        const buffer = readFileSync(presetPath)
        const ext = saved.backgroundPreset.split('.').pop()?.toLowerCase() || 'jpg'
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        saved.backgroundImage = `data:${mimeType};base64,${buffer.toString('base64')}`
      }
    }
    // 处理自定义图片
    else if (saved.backgroundImage && !saved.backgroundImage.startsWith('data:')) {
      const imagePath = join(getBackgroundsDir(), saved.backgroundImage)
      if (existsSync(imagePath)) {
        const imageBuffer = readFileSync(imagePath)
        const ext = saved.backgroundImage.split('.').pop()?.toLowerCase() || 'jpg'
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        saved.backgroundImage = `data:${mimeType};base64,${imageBuffer.toString('base64')}`
      }
    }

    return { ...DEFAULT_FLOATING_STYLE, ...saved }
  } catch {
    return { ...DEFAULT_FLOATING_STYLE }
  }
}

export function saveFloatingStyle(s: FloatingStyleConfig): void {
  const configToSave = { ...s }
  // data URL 不保存到配置文件（太大），只保留文件名或预设标识
  if (configToSave.backgroundImage && configToSave.backgroundImage.startsWith('data:')) {
    configToSave.backgroundImage = ''
  }
  writeFileSync(getStylePath(), JSON.stringify(configToSave, null, 2), 'utf-8')
}

// ============================================================
// 历史记录日志读取
// ============================================================

export interface SessionLogEntry {
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

export function listSessionLogs(): SessionLogEntry[] {
  const dir = getDataDir()
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()

  const logs: SessionLogEntry[] = []
  for (const filename of files) {
    try {
      const content = readFileSync(join(dir, filename), 'utf-8')
      const entry = parseSessionLog(filename, content)
      if (entry) logs.push(entry)
    } catch {
      // ignore
    }
  }
  return logs
}

function parseSessionLog(filename: string, content: string): SessionLogEntry | null {
  // 从文件名解析时间: YYYY-MM-DD_HH-MM-SS.md
  const nameMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.md$/)
  if (!nameMatch) return null

  const [, y, mo, d, h, mi, s] = nameMatch
  const date = `${y}-${mo}-${d}`
  const time = `${h}:${mi}:${s}`
  const timestamp = `${date} ${time}`

  // 解析 Markdown 表格
  const lines = content.split('\n')
  const models: SessionLogEntry['models'] = []
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0
  let totalCost = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|') || trimmed.includes('---') || trimmed.includes('模型')) continue

    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length < 5) continue

    const name = cells[0]
    if (name === '**合计**') {
      totalPromptTokens = parseNumber(cells[1])
      totalCompletionTokens = parseNumber(cells[2])
      totalTokens = parseNumber(cells[3])
      totalCost = parseCost(cells[4])
      continue
    }

    models.push({
      name,
      promptTokens: parseNumber(cells[1]),
      completionTokens: parseNumber(cells[2]),
      totalTokens: parseNumber(cells[3]),
      cost: parseCost(cells[4]),
      balance: cells[5] ? parseCost(cells[5]) : 0
    })
  }

  return { filename, timestamp, date, time, models, totalPromptTokens, totalCompletionTokens, totalTokens, totalCost }
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/[\*,\s]/g, '')
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? 0 : n
}

function parseCost(s: string): number {
  const cleaned = s.replace(/[¥\s,]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
