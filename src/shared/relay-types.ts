// ============================================================
// 本地 API 中转网关 — 类型定义
// ============================================================

/** 单个模型的配置 */
export interface ModelEntry {
  id: string                      // 请求中的模型名称 e.g. "deepseek-chat"
  name: string                    // 显示名称 e.g. "DeepSeek V4-Flash"
  apiFormat: 'openai' | 'anthropic'  // API 格式
  apiBase: string                 // 完整请求地址 e.g. https://api.deepseek.com/v1/chat/completions
  apiKey: string                  // API 密钥
  inputPrice: number              // 输入价格 (元 / 每千 tokens)
  outputPrice: number             // 输出价格 (元 / 每千 tokens)
  enabled: boolean                // 是否启用中转
  initialBalance: number          // 该模型初始余额 (元)
  alertThreshold: number          // 该模型预警阈值 (元)
  balanceQueryUrl?: string        // 可选：官方余额查询地址
  balanceQueryKey?: string        // 可选：余额查询密钥
}

/** 中转网关完整配置 */
export interface RelaySettings {
  port: number
  models: ModelEntry[]
  windowWidth: number
  windowHeight: number
  windowX: number
  windowY: number
  autoStart: boolean
}

/** 单个模型的运行时统计 */
export interface ModelRuntimeStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  balance: number                 // 当前余额 = initialBalance - 累计消耗（或官方校正值）
  alertThreshold: number          // 预警阈值快照
}

/** 运行时统计（内存状态） */
export interface RuntimeStats {
  // 本次会话
  sessionPromptTokens: number
  sessionCompletionTokens: number
  sessionTotalTokens: number
  sessionCost: number

  // 今日累计
  todayPromptTokens: number
  todayCompletionTokens: number
  todayTotalTokens: number
  todayCost: number

  // 历史总计（程序启动后恢复）
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCost: number

  // 按模型分拆
  modelStats: Record<string, ModelRuntimeStats>
}

/** 推送到浮窗的数据 */
export interface RelayStats {
  sessionTokens: number           // 本次使用总 token
  sessionCost: number             // 本次消费金额
  todayTokens: number             // 今日使用总 token
  todayCost: number               // 今日消费金额
  lastModel: string               // 最近使用的模型名
  timestamp: number
  serverRunning: boolean          // 中转服务是否运行中
  serverPort: number              // 中转服务端口
  modelStats: Record<string, {
    tokens: number
    cost: number
    balance: number
    name: string
  }>
  alerts?: string[]               // 余额预警信息
  activeModelNames: string[]      // 当前 session 中活跃的模型名列表
}

/** 每模型每日数据 */
export interface ModelDailyData {
  date: string
  modelId: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
}

/** 历史数据持久结构 */
export interface HistoricalData {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  totalCost: number
  /** 每模型累计消耗（用于启动时恢复余额） */
  modelCosts: Record<string, number>
}

/** 每日 session 中单个模型的数据 */
export interface DailySessionModel {
  modelId: string
  modelName: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
}

/** 每日 session（一次启动/运行周期） */
export interface DailySession {
  startTime: string
  endTime: string | null
  models: Record<string, DailySessionModel>
  totalTokens: number
  totalCost: number
}

/** 每日聚合数据（一天一个文件） */
export interface DailyData {
  date: string
  sessions: DailySession[]
  dailyTotalTokens: number
  dailyTotalCost: number
}

/** 背景类型 */
export type BackgroundType = 'solid' | 'image' | 'starry' | 'aurora' | 'particles'

/** 悬浮窗样式配置 */
export interface FloatingStyleConfig {
  // 整体背景
  backgroundColor: string
  backgroundOpacity: number
  // 背景样式
  backgroundType: BackgroundType
  backgroundImage: string         // 自定义图片路径
  backgroundImageOpacity: number  // 图片不透明度
  backgroundImageBlur: number     // 图片模糊度
  // 字体
  fontFamily: string
  fontSize: number
  // 各模块颜色
  tokenNumberColor: string
  timeColor: string
  sessionCostColor: string
  balanceColor: string
  modelNameColor: string
  modelTokensColor: string
  modelCostColor: string
  modelBalanceColor: string
  alertColor: string
  // 边框和装饰
  borderColor: string
  borderOpacity: number
  // 标签颜色
  labelColor: string
}

// ============================================================
// 默认值
// ============================================================

export const DEFAULT_RELAY_SETTINGS: RelaySettings = {
  port: 8001,
  models: [],
  windowWidth: 340,
  windowHeight: 260,
  windowX: -1,
  windowY: -1,
  autoStart: false
}

export const EMPTY_RUNTIME_STATS: RuntimeStats = {
  sessionPromptTokens: 0,
  sessionCompletionTokens: 0,
  sessionTotalTokens: 0,
  sessionCost: 0,
  todayPromptTokens: 0,
  todayCompletionTokens: 0,
  todayTotalTokens: 0,
  todayCost: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  totalCost: 0,
  modelStats: {}
}

export const DEFAULT_FLOATING_STYLE: FloatingStyleConfig = {
  backgroundColor: '#12161e',
  backgroundOpacity: 0.97,
  backgroundType: 'solid',
  backgroundImage: '',
  backgroundImageOpacity: 0.3,
  backgroundImageBlur: 0,
  fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif",
  fontSize: 14,
  tokenNumberColor: '#9ed89a',
  timeColor: '#ffffff',
  sessionCostColor: '#6ab0d9',
  balanceColor: '#8ed88a',
  modelNameColor: '#6a7a8a',
  modelTokensColor: '#8ed88a',
  modelCostColor: '#e0b060',
  modelBalanceColor: '#8ed88a',
  alertColor: '#f48771',
  borderColor: '#ffffff',
  borderOpacity: 0.06,
  labelColor: '#4a4a4a'
}
