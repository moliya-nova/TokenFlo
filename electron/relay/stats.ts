import type { RuntimeStats, ModelRuntimeStats, RelayStats, RelaySettings, ModelEntry, DailyData, DailySession, DailySessionModel } from '../../src/shared/relay-types'
import { EMPTY_RUNTIME_STATS } from '../../src/shared/relay-types'
import {
  loadHistoricalData, saveHistoricalData,
  loadModelDaily, getTodayDate,
  saveSessionLog,
  loadDailyData, saveDailyData, migrateOldDailyData
} from './persistence'

type StatsCallback = (stats: RelayStats) => void
type AlertCallback = (message: string) => void

let stats: RuntimeStats = { ...EMPTY_RUNTIME_STATS }
let lastModelUsed = ''
let currentDate = getTodayDate()
let onUpdate: StatsCallback | null = null
let onAlert: AlertCallback | null = null
let currentSettings: RelaySettings | null = null
let serverRunning = false
let serverPort = 0

let currentDailyData: DailyData | null = null
let currentSession: DailySession | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null

// ============================================================
// 初始化
// ============================================================

export function initStats(
  settings: RelaySettings,
  updateCb: StatsCallback,
  alertCb?: AlertCallback
): void {
  currentSettings = settings
  onUpdate = updateCb
  onAlert = alertCb || null

  // 迁移旧格式数据（仅首次）
  migrateOldDailyData()

  // 恢复历史总计
  const historical = loadHistoricalData()
  stats = {
    ...EMPTY_RUNTIME_STATS,
    totalPromptTokens: historical.totalPromptTokens,
    totalCompletionTokens: historical.totalCompletionTokens,
    totalTokens: historical.totalTokens,
    totalCost: historical.totalCost,
    modelStats: {}
  }

  // 为每个模型初始化运行时统计（含余额恢复）
  for (const model of settings.models) {
    const modelHistoricalCost = historical.modelCosts[model.id] || 0
    stats.modelStats[model.id] = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      balance: model.initialBalance - modelHistoricalCost,
      alertThreshold: model.alertThreshold
    }
  }

  // 恢复今日数据（新格式：一天一个文件）
  currentDate = getTodayDate()
  currentDailyData = loadDailyData(currentDate)

  if (currentDailyData) {
    // 从已有 sessions 累加今日统计（不含进行中的空 session）
    for (const session of currentDailyData.sessions) {
      for (const [modelId, m] of Object.entries(session.models)) {
        stats.todayPromptTokens += m.promptTokens
        stats.todayCompletionTokens += m.completionTokens
        stats.todayTotalTokens += m.totalTokens
        stats.todayCost += m.cost
        if (stats.modelStats[modelId]) {
          stats.modelStats[modelId].promptTokens += m.promptTokens
          stats.modelStats[modelId].completionTokens += m.completionTokens
          stats.modelStats[modelId].totalTokens += m.totalTokens
          stats.modelStats[modelId].cost += m.cost
          stats.modelStats[modelId].balance -= m.cost
        }
      }
    }

    // 处理崩溃恢复：关闭未结束的 session
    for (const session of currentDailyData.sessions) {
      if (session.endTime === null) {
        session.endTime = new Date().toISOString()
      }
    }
  } else {
    currentDailyData = {
      date: currentDate,
      sessions: [],
      dailyTotalTokens: 0,
      dailyTotalCost: 0
    }
  }

  // 创建新 session
  currentSession = {
    startTime: new Date().toISOString(),
    endTime: null,
    models: {},
    totalTokens: 0,
    totalCost: 0
  }
  currentDailyData.sessions.push(currentSession)

  pushUpdate()
}

// ============================================================
// 记录用量
// ============================================================

export function recordUsage(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): void {
  checkDayChange()

  const totalTokens = promptTokens + completionTokens
  const modelConfig = findModel(modelId)
  if (!modelConfig) {
    console.warn(`[Stats] Unknown model: ${modelId}, using default pricing`)
  }

  // 计算消费
  const inputPrice = modelConfig?.inputPrice ?? 0
  const outputPrice = modelConfig?.outputPrice ?? 0
  const cost = (promptTokens / 1000) * inputPrice + (completionTokens / 1000) * outputPrice

  // 更新本次会话
  stats.sessionPromptTokens += promptTokens
  stats.sessionCompletionTokens += completionTokens
  stats.sessionTotalTokens += totalTokens
  stats.sessionCost += cost

  // 更新今日
  stats.todayPromptTokens += promptTokens
  stats.todayCompletionTokens += completionTokens
  stats.todayTotalTokens += totalTokens
  stats.todayCost += cost

  // 更新历史总计
  stats.totalPromptTokens += promptTokens
  stats.totalCompletionTokens += completionTokens
  stats.totalTokens += totalTokens
  stats.totalCost += cost

  // 更新按模型统计
  if (!stats.modelStats[modelId]) {
    const model = findModel(modelId)
    stats.modelStats[modelId] = {
      promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0,
      balance: model?.initialBalance ?? 0,
      alertThreshold: model?.alertThreshold ?? 0
    }
  }
  const ms = stats.modelStats[modelId]
  ms.promptTokens += promptTokens
  ms.completionTokens += completionTokens
  ms.totalTokens += totalTokens
  ms.cost += cost
  ms.balance -= cost

  lastModelUsed = modelId

  // 更新当前 session 的模型数据
  if (currentSession) {
    if (!currentSession.models[modelId]) {
      currentSession.models[modelId] = {
        modelId,
        modelName: modelConfig?.name || modelId,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      }
    }
    const sm = currentSession.models[modelId]
    sm.promptTokens += promptTokens
    sm.completionTokens += completionTokens
    sm.totalTokens += totalTokens
    sm.cost += cost
    currentSession.totalTokens += totalTokens
    currentSession.totalCost += cost
  }

  // 更新每日合计
  if (currentDailyData) {
    currentDailyData.dailyTotalTokens += totalTokens
    currentDailyData.dailyTotalCost += cost
  }

  // 防抖持久化每日数据
  scheduleFlush()

  // 持久化历史总计（含每模型累计消耗）
  const modelCosts: Record<string, number> = {}
  for (const [id, s] of Object.entries(stats.modelStats)) {
    const modelCfg = currentSettings?.models.find(m => m.id === id)
    if (modelCfg) {
      modelCosts[id] = modelCfg.initialBalance - s.balance
    }
  }
  saveHistoricalData({
    totalPromptTokens: stats.totalPromptTokens,
    totalCompletionTokens: stats.totalCompletionTokens,
    totalTokens: stats.totalTokens,
    totalCost: stats.totalCost,
    modelCosts
  })

  // 每模型独立预警检查
  if (onAlert && ms.alertThreshold > 0 && ms.balance <= ms.alertThreshold) {
    const modelName = findModel(modelId)?.name || modelId
    onAlert(`余额预警：${modelName} 当前余额 ${ms.balance.toFixed(2)} 元，已达到预警阈值 ${ms.alertThreshold} 元`)
  }

  pushUpdate()
}

// ============================================================
// 跨日重置
// ============================================================

function checkDayChange(): void {
  const today = getTodayDate()
  if (today !== currentDate) {
    // 关闭当前 session
    closeCurrentSession()

    currentDate = today
    stats.todayPromptTokens = 0
    stats.todayCompletionTokens = 0
    stats.todayTotalTokens = 0
    stats.todayCost = 0
    // 重置每模型今日统计
    for (const id of Object.keys(stats.modelStats)) {
      stats.modelStats[id].promptTokens = 0
      stats.modelStats[id].completionTokens = 0
      stats.modelStats[id].totalTokens = 0
      stats.modelStats[id].cost = 0
    }

    // 创建新的每日数据和 session
    currentDailyData = {
      date: today,
      sessions: [],
      dailyTotalTokens: 0,
      dailyTotalCost: 0
    }
    currentSession = {
      startTime: new Date().toISOString(),
      endTime: null,
      models: {},
      totalTokens: 0,
      totalCost: 0
    }
    currentDailyData.sessions.push(currentSession)
  }
}

// ============================================================
// 查询当前状态
// ============================================================

export function getStats(): RuntimeStats {
  return { ...stats, modelStats: { ...stats.modelStats } }
}

export function getCurrentRelayStats(serverRunning: boolean, serverPort: number): RelayStats {
  return buildRelayStats(serverRunning, serverPort)
}

export function getLastModel(): string {
  return lastModelUsed
}

// ============================================================
// 余额校正（由余额查询模块调用）
// ============================================================

export function correctModelBalance(modelId: string, realBalance: number): void {
  if (stats.modelStats[modelId]) {
    stats.modelStats[modelId].balance = realBalance
    pushUpdate()
  }
}

// ============================================================
// 获取预警信息
// ============================================================

export function getModelAlerts(): string[] {
  const alerts: string[] = []
  for (const [id, ms] of Object.entries(stats.modelStats)) {
    if (ms.alertThreshold > 0 && ms.balance <= ms.alertThreshold) {
      const modelName = currentSettings?.models.find(m => m.id === id)?.name || id
      alerts.push(`${modelName}: 余额 ${ms.balance.toFixed(2)} 元 ≤ 阈值 ${ms.alertThreshold} 元`)
    }
  }
  return alerts
}

// ============================================================
// Session 生命周期
// ============================================================

export function closeCurrentSession(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (currentSession && currentSession.endTime === null) {
    currentSession.endTime = new Date().toISOString()
    if (currentDailyData) {
      saveDailyData(currentDailyData)
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (currentDailyData) {
      saveDailyData(currentDailyData)
    }
  }, 3000)
}

// ============================================================
// 保存会话日志
// ============================================================

export function flushSessionLog(): string | null {
  closeCurrentSession()
  if (!currentSettings) return null
  const modelStats = stats.modelStats
  if (Object.keys(modelStats).length === 0) return null
  return saveSessionLog(modelStats, currentSettings)
}

// ============================================================
// 推送更新
// ============================================================

function pushUpdate(): void {
  if (!onUpdate) return
  onUpdate(buildRelayStats(serverRunning, serverPort))
}

export function pushServerState(running: boolean, port: number): void {
  serverRunning = running
  serverPort = port
  if (!onUpdate) return
  onUpdate(buildRelayStats(running, port))
}

function buildRelayStats(running: boolean, port?: number): RelayStats {
  const modelStatsResult: Record<string, { tokens: number; cost: number; balance: number; name: string }> = {}

  for (const [id, ms] of Object.entries(stats.modelStats)) {
    const modelName = currentSettings?.models.find(m => m.id === id)?.name || id
    modelStatsResult[id] = {
      tokens: ms.totalTokens,
      cost: ms.cost,
      balance: ms.balance,
      name: modelName
    }
  }

  // 收集当前 session 中活跃的模型名
  const activeModelNames: string[] = []
  if (currentSession) {
    for (const m of Object.values(currentSession.models)) {
      if (m.totalTokens > 0) {
        activeModelNames.push(m.modelName)
      }
    }
  }

  return {
    sessionTokens: stats.sessionTotalTokens,
    sessionCost: stats.sessionCost,
    todayTokens: stats.todayTotalTokens,
    todayCost: stats.todayCost,
    lastModel: lastModelUsed,
    timestamp: Date.now(),
    serverRunning: running,
    serverPort: port ?? currentSettings?.port ?? 0,
    modelStats: modelStatsResult,
    alerts: getModelAlerts(),
    activeModelNames
  }
}

// ============================================================
// 辅助
// ============================================================

function findModel(modelId: string): ModelEntry | undefined {
  return currentSettings?.models.find(m => m.id === modelId && m.enabled !== false)
}

export function updateSettings(settings: RelaySettings): void {
  currentSettings = settings
  // 同步每模型的预警阈值
  for (const model of settings.models) {
    if (stats.modelStats[model.id]) {
      stats.modelStats[model.id].alertThreshold = model.alertThreshold
    }
  }
  pushUpdate()
}
