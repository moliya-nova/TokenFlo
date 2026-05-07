import type { ModelEntry } from '../../src/shared/relay-types'

type GetModelsFn = () => ModelEntry[]
type BalanceCallback = (modelId: string, realBalance: number) => void

let intervalId: ReturnType<typeof setInterval> | null = null

/**
 * 启动余额查询器
 * 每 60 秒查询一次配置了 balanceQueryUrl 的模型的官方余额
 */
export function startBalanceChecker(
  getModels: GetModelsFn,
  onBalanceCorrected: BalanceCallback
): void {
  stopBalanceChecker()

  async function checkAll() {
    const models = getModels()
    for (const model of models) {
      if (!model.enabled || !model.balanceQueryUrl) continue
      try {
        const balance = await queryBalance(model)
        if (balance !== null) {
          onBalanceCorrected(model.id, balance)
        }
      } catch (e: any) {
        console.warn(`[BalanceChecker] 查询 ${model.id} 余额失败:`, e.message)
      }
    }
  }

  // 立即执行一次，之后每 60 秒执行
  checkAll()
  intervalId = setInterval(checkAll, 60_000)
}

export function stopBalanceChecker(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

/**
 * 查询单个模型的官方余额
 */
async function queryBalance(model: ModelEntry): Promise<number | null> {
  const headers: Record<string, string> = {}
  const key = model.balanceQueryKey || model.apiKey
  if (key) {
    headers['Authorization'] = `Bearer ${key}`
  }

  const resp = await fetch(model.balanceQueryUrl!, { headers })
  if (!resp.ok) {
    console.warn(`[BalanceChecker] ${model.id} 余额接口返回 ${resp.status}`)
    return null
  }

  const data = await resp.json()
  return extractBalanceField(data)
}

/**
 * 通用余额字段提取
 * 尝试多种常见 API 响应格式
 */
function extractBalanceField(data: any): number | null {
  if (data == null || typeof data !== 'object') return null

  // 直接有 balance 字段
  if (typeof data.balance === 'number') return data.balance

  // data.balance (string or number)
  if (data.data && data.data.balance != null) return Number(data.data.balance)

  // DeepSeek 格式: balance_infos[0].total_balance
  if (Array.isArray(data.balance_infos) && data.balance_infos.length > 0) {
    const v = data.balance_infos[0].total_balance
    if (v != null) return Number(v)
  }

  // OpenAI 格式: total_available / total_granted / total_used
  if (data.total_available != null) return Number(data.total_available)

  // 通用: data.total_balance
  if (data.data && data.data.total_balance != null) return Number(data.data.total_balance)

  // 通用: data.remaining
  if (data.remaining != null) return Number(data.remaining)
  if (data.data && data.data.remaining != null) return Number(data.data.remaining)

  console.warn('[BalanceChecker] 无法识别余额字段，原始响应:', JSON.stringify(data).slice(0, 200))
  return null
}
