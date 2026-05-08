<template>
  <div class="float-container" :class="{ 'has-image-bg': styleConfig.backgroundType === 'image' }" :style="containerStyle">
    <!-- 背景层 -->
    <div class="background-layer">
      <SolidBackground v-if="styleConfig.backgroundType === 'solid'" :config="styleConfig" />
      <ImageBackground v-else-if="styleConfig.backgroundType === 'image'" :config="styleConfig" />
    </div>
    <div class="bg-texture"></div>
    <div class="drag-overlay"></div>
    <div class="header">
      <div class="live-indicator">
        <span class="pulse-dot" :class="{ active: serverRunning, error: !serverRunning && !loading }"></span>
        <span class="live-text">{{ serverRunning ? `LIVE :${serverPort}` : 'OFFLINE' }}</span>
      </div>
      <button class="close-btn" @click.stop="onClose">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>
    </div>

    <div v-if="loading" class="status-area">
      <div class="loading-spinner"></div>
      <span class="loading-text">等待中转连接...</span>
    </div>
    <div v-else-if="error" class="status-area">
      <div class="error-icon">!</div>
      <span class="error-text">{{ error }}</span>
    </div>

    <template v-else>
      <div class="metrics">
        <div class="metric-primary">
          <div class="digit-roller-container" :style="{ color: styleConfig.tokenNumberColor, fontFamily: 'DigitalNumbers, ' + styleConfig.fontFamily, fontSize: (styleConfig.fontSize + 26) + 'px' }">
            <div v-for="(d, i) in tokenDigits" :key="'t' + i" class="digit-roller">
              <div class="digit-strip" :style="digitStripStyle(d)">
                <span v-for="n in 10" :key="n" class="digit-cell">{{ n - 1 }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="currentModelName" class="model-display-name">
          <span :style="{ color: styleConfig.modelNameColor, fontFamily: styleConfig.fontFamily }">{{ currentModelName }}</span>
        </div>
        <div v-if="alerts.length > 0" class="alerts">
          <div v-for="(alert, i) in alerts" :key="i" class="alert-item" :style="{ color: styleConfig.alertColor, borderColor: hexToRgba(styleConfig.alertColor, 0.15), background: hexToRgba(styleConfig.alertColor, 0.06) }">{{ alert }}</div>
        </div>
        <div class="time-glass-bar">
          <div class="glass-item">
            <span class="glass-label" :style="{ color: styleConfig.labelColor }">时间</span>
            <span class="glass-value" :style="{ color: styleConfig.timeColor, fontFamily: styleConfig.fontFamily }">{{ timeText }}</span>
          </div>
          <div class="glass-divider"></div>
          <div class="glass-item">
            <span class="glass-label" :style="{ color: styleConfig.labelColor }">今日消费</span>
            <span class="glass-value" :style="{ color: styleConfig.sessionCostColor, fontFamily: styleConfig.fontFamily }">{{ costDisplayText }}</span>
          </div>
          <div class="glass-divider"></div>
          <div class="glass-item">
            <span class="glass-label" :style="{ color: styleConfig.labelColor }">总余额</span>
            <span class="glass-value" :style="{ color: styleConfig.balanceColor, fontFamily: styleConfig.fontFamily }">{{ totalBalanceText }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FloatingStyleConfig } from '../../shared/relay-types'
import { DEFAULT_FLOATING_STYLE } from '../../shared/relay-types'
import { SolidBackground, ImageBackground } from './backgrounds'

const loading = ref(true)
const error = ref('')
const todayTokens = ref(0)
const todayCost = ref(0)
const lastModel = ref('')
const timestamp = ref(0)
const serverRunning = ref(false)
const serverPort = ref(0)
const modelStats = ref<Record<string, { tokens: number; cost: number; balance: number }>>({})
const alerts = ref<string[]>([])
const activeModelNames = ref<string[]>([])
const currentModelName = ref('')
const currentModelIndex = ref(0)

let cleanupStats: (() => void) | null = null
let cleanupError: (() => void) | null = null
let cleanupStyle: (() => void) | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let modelRotationTimer: ReturnType<typeof setInterval> | null = null
const currentTime = ref(Date.now())

// 样式配置
const styleConfig = ref<FloatingStyleConfig>({ ...DEFAULT_FLOATING_STYLE })

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 计算容器样式
const containerStyle = computed(() => {
  const bg = hexToRgba(styleConfig.value.backgroundColor, styleConfig.value.backgroundOpacity)
  return {
    background: styleConfig.value.backgroundType === 'image'
      ? 'transparent'
      : `linear-gradient(145deg, ${bg} 0%, ${bg} 100%)`,
    fontFamily: styleConfig.value.fontFamily
  }
})

function startClock() {
  clockTimer = setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
}

// ============================================================
// 滚轮式逐位数字动画
// ============================================================

// Token 动画状态
const tokenCurrentDigits = ref<number[]>([0])
const tokenTargetDigits = ref<number[]>([0])
let tokenAnimFrame: number | null = null
let tokenLastStepTime = 0
let tokenStartValue = 0
let tokenTotalSteps = 0
let tokenCurrentStep = 0
const TOKEN_STEP_MIN = 30    // 最快步进间隔
const TOKEN_STEP_MAX = 200   // 最慢步进间隔

// Cost 动画状态（线性插值）
const displayCost = ref(0)
const costTarget = ref(0)
let costAnimFrame: number | null = null

/** 将整数拆为数位数组（高位在前） */
function intToDigits(n: number): number[] {
  const s = String(Math.max(0, Math.round(n)))
  return s.split('').map(Number)
}

/** 计算当前步的间隔（加速-匀速-减速） */
function calcStepInterval(): number {
  if (tokenTotalSteps <= 1) return TOKEN_STEP_MIN
  const progress = tokenCurrentStep / tokenTotalSteps
  let factor: number
  if (progress < 0.2) {
    // 加速阶段：从慢到快
    factor = 1 - (progress / 0.2) * 0.7
  } else if (progress > 0.8) {
    // 减速阶段：从快到慢
    factor = 0.3 + ((progress - 0.8) / 0.2) * 0.7
  } else {
    // 匀速阶段
    factor = 0.3
  }
  return TOKEN_STEP_MIN + (TOKEN_STEP_MAX - TOKEN_STEP_MIN) * factor
}

/** Token 滚轮动画帧 */
function stepTokenAnim(time: number) {
  const interval = calcStepInterval()
  if (time - tokenLastStepTime < interval) {
    tokenAnimFrame = requestAnimationFrame(stepTokenAnim)
    return
  }
  tokenLastStepTime = time
  tokenCurrentStep++

  const current = [...tokenCurrentDigits.value]
  const target = tokenTargetDigits.value

  while (current.length < target.length) current.unshift(0)

  let allDone = true
  for (let i = 0; i < current.length; i++) {
    const t = i < target.length ? target[i] : 0
    if (current[i] !== t) {
      allDone = false
      current[i] = (current[i] + 1) % 10
    }
  }

  tokenCurrentDigits.value = current

  if (allDone) {
    tokenAnimFrame = null
  } else {
    tokenAnimFrame = requestAnimationFrame(stepTokenAnim)
  }
}

/** Cost 线性插值动画帧 */
function stepCostAnim() {
  const target = costTarget.value
  const diff = target - displayCost.value
  if (Math.abs(diff) < 0.00005) {
    displayCost.value = target
    costAnimFrame = null
    return
  }
  const step = Math.min(Math.abs(diff), Math.max(0.0001, Math.abs(diff) * 0.15))
  displayCost.value += diff > 0 ? step : -step
  costAnimFrame = requestAnimationFrame(stepCostAnim)
}

/** 设置 Token 目标值并启动动画 */
function animateTokenTo(target: number) {
  const newTarget = intToDigits(target)
  const current = tokenCurrentDigits.value

  while (current.length < newTarget.length) {
    current.unshift(0)
    tokenCurrentDigits.value = [...current]
  }

  // 计算当前值和目标值的差值
  const currentVal = parseInt(current.join('')) || 0
  const targetVal = parseInt(newTarget.join('')) || 0
  tokenStartValue = currentVal
  tokenTotalSteps = Math.abs(targetVal - currentVal)
  tokenCurrentStep = 0

  tokenTargetDigits.value = newTarget
  if (!tokenAnimFrame) {
    tokenLastStepTime = 0
    tokenAnimFrame = requestAnimationFrame(stepTokenAnim)
  }
}

/** 设置 Cost 目标值并启动动画 */
function animateCostTo(target: number) {
  costTarget.value = target
  if (!costAnimFrame) {
    costAnimFrame = requestAnimationFrame(stepCostAnim)
  }
}

/** 更新模型名显示（单模型直接显示，多模型循环切换） */
function updateModelDisplayName() {
  if (modelRotationTimer) {
    clearInterval(modelRotationTimer)
    modelRotationTimer = null
  }

  const names = activeModelNames.value
  if (names.length === 0) {
    currentModelName.value = lastModel.value || ''
  } else if (names.length === 1) {
    currentModelName.value = names[0]
  } else {
    currentModelIndex.value = 0
    currentModelName.value = names[0]
    modelRotationTimer = setInterval(() => {
      currentModelIndex.value = (currentModelIndex.value + 1) % names.length
      currentModelName.value = names[currentModelIndex.value]
    }, 3000)
  }
}

// 模板用：token 数位数组
const tokenDigits = computed(() => tokenCurrentDigits.value)


/** 数位滚轮的 translateY 样式 */
function digitStripStyle(digit: number | '.'): Record<string, string> {
  if (digit === '.') return {}
  return { transform: `translateY(-${digit * 1.2}em)` }
}

// ============================================================
// 数据接收
// ============================================================

function applyStats(data: any) {
  loading.value = false
  error.value = ''
  const newTodayTokens = data.todayTokens || 0
  const newTodayCost = data.todayCost || 0
  todayTokens.value = newTodayTokens
  todayCost.value = newTodayCost
  lastModel.value = data.lastModel || ''
  timestamp.value = data.timestamp
  serverRunning.value = data.serverRunning
  serverPort.value = data.serverPort || 0
  modelStats.value = data.modelStats || {}
  alerts.value = data.alerts || []
  activeModelNames.value = data.activeModelNames || []
  animateTokenTo(newTodayTokens)
  animateCostTo(newTodayCost)
  updateModelDisplayName()
}

function applyStyle(style: FloatingStyleConfig) {
  styleConfig.value = { ...style }
}

onMounted(async () => {
  startClock()
  cleanupStats = window.electronAPI.onRelayStats(applyStats)
  cleanupError = window.electronAPI.onRelayError((err) => {
    loading.value = false
    error.value = err
  })
  cleanupStyle = window.electronAPI.onStyleUpdate((style) => {
    applyStyle(style)
  })

  // 加载保存的样式
  try {
    const savedStyle = await window.electronAPI.getFloatingStyle()
    if (savedStyle) applyStyle(savedStyle)
  } catch {
    // ignore
  }

  try {
    const current = await window.electronAPI.getRelayStats()
    if (current) applyStats(current)
  } catch {
    // ignore
  }
})

onUnmounted(() => {
  cleanupStats?.()
  cleanupError?.()
  cleanupStyle?.()
  if (tokenAnimFrame) cancelAnimationFrame(tokenAnimFrame)
  if (costAnimFrame) cancelAnimationFrame(costAnimFrame)
  if (clockTimer) clearInterval(clockTimer)
  if (modelRotationTimer) clearInterval(modelRotationTimer)
})

const totalBalance = computed(() => {
  let sum = 0
  for (const ms of Object.values(modelStats.value)) {
    sum += ms.balance
  }
  return sum
})

const totalBalanceText = computed(() => {
  const b = totalBalance.value
  if (Math.abs(b) < 0.01) return '¥ 0.00'
  return '¥ ' + b.toFixed(2)
})

const costDisplayText = computed(() => {
  const c = displayCost.value
  if (Math.abs(c) < 0.0001) return '¥ 0.0000'
  return '¥ ' + c.toFixed(4)
})

const timeText = computed(() => {
  const d = new Date(currentTime.value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

function onClose() { window.electronAPI.closeFloatingWindow() }

</script>

<style>
@font-face {
  font-family: 'DigitalNumbers';
  src: url('./fonts/DigitalNumbers-Regular.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; background: transparent; overflow: hidden; }

.float-container {
  user-select: none; position: relative;
  width: 100vw; height: 100vh;
  background: linear-gradient(145deg, rgba(18,22,30,0.97) 0%, rgba(12,16,24,0.98) 100%);
  border: none;
  border-radius: 16px; color: #e0e0e0;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0,0,0,0.4),
    0 2px 8px rgba(0,0,0,0.2);
  cursor: default;
  -webkit-mask-image: -webkit-radial-gradient(white, black);
}

.float-container.has-image-bg::before {
  display: none;
}

.float-container.has-image-bg .bg-texture {
  display: none;
}

.float-container::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 60%;
  background: radial-gradient(ellipse at 30% 0%, rgba(74,144,217,0.08) 0%, transparent 60%),
              radial-gradient(ellipse at 70% 20%, rgba(126,200,123,0.05) 0%, transparent 50%);
  pointer-events: none;
  border-radius: 0;
}

.background-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 16px;
  overflow: hidden;
}

.bg-texture {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.02;
  background-image:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  border-radius: 16px;
}

.drag-overlay {
  -webkit-app-region: drag;
  position: absolute;
  inset: 0;
  z-index: 5;
}

.header {
  -webkit-app-region: drag;
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
  transition: opacity 0.2s ease;
}
.float-container:hover .header {
  opacity: 1;
  pointer-events: auto;
}
.live-indicator { display: flex; align-items: center; gap: 6px; }
.pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #3a3a3a;
  transition: all 0.3s ease;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}
.pulse-dot.active {
  background: linear-gradient(135deg, #8ed88a 0%, #5cb85c 100%);
  box-shadow: 0 0 10px rgba(126,200,123,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
  animation: pulse 2s infinite ease-in-out;
}
.pulse-dot.error {
  background: linear-gradient(135deg, #f48771 0%, #d9534f 100%);
  box-shadow: 0 0 10px rgba(244,135,113,0.5);
}
@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.9); } }
.live-text { font-size: 9px; letter-spacing: 1.5px; color: #5a5a5a; font-weight: 600; text-transform: uppercase; }

.close-btn {
  -webkit-app-region: no-drag;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  color: #555; cursor: pointer;
  padding: 3px; border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}
.close-btn:hover {
  background: rgba(244,100,100,0.12);
  border-color: rgba(244,100,100,0.2);
  color: #f66;
  transform: scale(1.05);
}

.status-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; z-index: 1; }
.loading-spinner { width: 28px; height: 28px; border: 2px solid rgba(255,255,255,0.06); border-top-color: #4a90d9; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 12px; color: #555; }
.error-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(244,135,113,0.1); border: 1px solid rgba(244,135,113,0.25); color: #f48771; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; }
.error-text { font-size: 12px; color: #f48771; text-align: center; max-width: 80%; line-height: 1.5; }

.metrics { flex: 1; display: flex; flex-direction: column; padding: 12px 16px 0; z-index: 1; gap: 10px; overflow: hidden; }
.metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #4a4a4a; margin-bottom: 2px; font-weight: 500; }

.metric-primary {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(145deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 12px; padding: 14px 0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
}

/* ============================================================
   滚轮数字动画样式
   ============================================================ */
.digit-roller-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  height: 1.2em;
}
.digit-roller {
  width: 0.72em;
  height: 1.2em;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}
.digit-strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
  transition: transform 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.digit-cell {
  width: 0.72em;
  height: 1.2em;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(180deg, #9ed89a 0%, #6ab06a 50%, #4a9a4a 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.metric-model { font-size: 10px; color: #4a90d9; margin-top: 4px; }

.model-display-name {
  text-align: center;
  padding: 0;
  font-size: 12px;
  letter-spacing: 0.5px;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  line-height: 1.2;
}

.alerts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.alert-item {
  font-size: 10px; color: #f48771;
  background: linear-gradient(135deg, rgba(244,135,113,0.06) 0%, rgba(244,135,113,0.02) 100%);
  border: 1px solid rgba(244,135,113,0.15);
  border-radius: 6px; padding: 4px 8px;
}

.time-glass-bar {
  position: relative;
  display: flex;
  align-items: stretch;
  padding: 6px 28px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.04) 40%,
    rgba(255, 255, 255, 0.06) 60%,
    rgba(255, 255, 255, 0.03) 100%
  );
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0 0 16px 16px;
  overflow: hidden;
  margin-top: auto;
  margin-left: -16px;
  margin-right: -16px;
}

.time-glass-bar::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
}

.time-glass-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  animation: glass-shimmer 8s ease-in-out infinite;
}

@keyframes glass-shimmer {
  0% { left: -60%; }
  50% { left: 100%; }
  100% { left: 100%; }
}

.glass-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  position: relative;
  z-index: 1;
}

.glass-label {
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.6;
}

.glass-value {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.glass-divider {
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent 100%);
  align-self: stretch;
}
</style>
