<template>
  <div class="app">
    <!-- 顶部标题栏 -->
    <div class="app-header">
      <div class="header-left">
        <div class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
            <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.8"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1" opacity="0.4"/>
          </svg>
        </div>
        <div class="header-title">
          <h1>Token 本地中转网关</h1>
          <span class="header-version">v1.0</span>
        </div>
      </div>
      <div class="status-pill" :class="{ running: relayRunning }">
        <span class="status-dot"></span>
        <span class="status-text">{{ relayRunning ? `运行中 :${relayPort}` : '已停止' }}</span>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content">
      <!-- ========== 模型配置 ========== -->
      <div v-if="activeTab === 'models'" class="tab-panel">
        <!-- 基础设置卡片 -->
        <div class="panel-card">
          <div class="card-title">
            <span class="card-icon">⚙</span>
            <span>基础设置</span>
          </div>
          <div class="card-body">
            <div class="form-row two-col">
              <div class="form-field">
                <label>中转端口</label>
                <input v-model.number="form.port" type="number" min="1024" max="65535" />
              </div>
              <div class="form-field toggle-field">
                <label>开机自启动</label>
                <label class="toggle">
                  <input v-model="form.autoStart" type="checkbox" />
                  <span class="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型列表卡片 -->
        <div class="panel-card">
          <div class="card-title">
            <span class="card-icon">🧠</span>
            <span>模型列表</span>
            <button class="btn-add-sm" @click="openModelModal()">+ 添加模型</button>
          </div>
          <div class="card-body">
            <div v-if="form.models.length === 0" class="empty-state">
              <div class="empty-icon">📭</div>
              <div class="empty-text">暂无模型配置</div>
              <div class="empty-sub">点击右上角"添加模型"开始配置</div>
            </div>
            <div v-else class="model-list">
              <div
                v-for="(m, idx) in form.models"
                :key="m.id"
                class="model-card"
                :class="{ disabled: m.enabled === false }"
              >
                <div class="model-card-header">
                  <div class="model-name-row">
                    <span class="toggle-sm" @click="toggleModel(idx)">
                      <span class="toggle-dot" :class="{ on: m.enabled !== false }"></span>
                    </span>
                    <strong class="model-display-name">{{ m.name || m.id }}</strong>
                    <span class="tag" :class="m.apiFormat || 'openai'">
                      {{ (m.apiFormat || 'openai') === 'anthropic' ? 'Anthropic' : 'OpenAI' }}
                    </span>
                    <span v-if="m.balanceQueryUrl" class="tag tag-green">余额同步</span>
                  </div>
                  <div class="model-actions">
                    <button class="btn-icon" @click="openModelModal(idx)" title="编辑">✎</button>
                    <button class="btn-icon danger" @click="onRemoveModel(idx)" title="删除">✕</button>
                  </div>
                </div>
                <div class="model-card-body">
                  <div class="model-meta-row">
                    <span class="meta-item">
                      <span class="meta-label">ID</span>
                      <span class="meta-value mono">{{ m.id }}</span>
                    </span>
                    <span class="meta-item">
                      <span class="meta-label">地址</span>
                      <span class="meta-value">{{ m.apiBase }}</span>
                    </span>
                  </div>
                  <div class="model-meta-row">
                    <span class="meta-item">
                      <span class="meta-label">输入</span>
                      <span class="meta-value price">¥{{ m.inputPrice }}/1K</span>
                    </span>
                    <span class="meta-item">
                      <span class="meta-label">输出</span>
                      <span class="meta-value price">¥{{ m.outputPrice }}/1K</span>
                    </span>
                    <span class="meta-item">
                      <span class="meta-label">余额</span>
                      <span class="meta-value price">¥{{ m.initialBalance }}</span>
                    </span>
                    <span class="meta-item">
                      <span class="meta-label">阈值</span>
                      <span class="meta-value price">¥{{ m.alertThreshold }}</span>
                    </span>
                  </div>
                  <div v-if="m.apiKey" class="model-meta-row">
                    <span class="meta-item">
                      <span class="meta-label">Key</span>
                      <span class="meta-value mono key-mask">{{ m.apiKey.slice(0, 6) }}...{{ m.apiKey.slice(-4) }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="panel-actions">
          <button class="btn-primary" @click="onSaveAndStart">
            <span class="btn-icon-inner">▶</span>
            <span>保存并启动中转 + 悬浮窗</span>
          </button>
          <div class="hint">
            客户端将 API 地址改为 <code>http://127.0.0.1:{{ form.port }}/v1</code> 即可自动中转统计
          </div>
        </div>
      </div>

      <!-- ========== 样式配置 ========== -->
      <div v-if="activeTab === 'style'" class="tab-panel">
        <div class="panel-card">
          <div class="card-title">
            <span class="card-icon">🎨</span>
            <span>悬浮窗样式</span>
          </div>
          <div class="card-body">
            <!-- 背景样式选择 -->
            <div class="style-section">
              <div class="section-label">背景样式</div>
              <div class="background-type-grid">
                <div
                  v-for="bg in backgroundTypes"
                  :key="bg.value"
                  class="bg-type-card"
                  :class="{ active: styleForm.backgroundType === bg.value }"
                  @click="styleForm.backgroundType = bg.value"
                >
                  <div class="bg-preview" :style="bg.previewStyle"></div>
                  <span class="bg-label">{{ bg.label }}</span>
                </div>
              </div>

              <!-- 图片背景选项 -->
              <div v-if="styleForm.backgroundType === 'image'" class="image-options">
                <!-- 预设背景网格 -->
                <div class="preset-grid">
                  <div
                    v-for="preset in presetImages"
                    :key="preset.filename"
                    class="preset-card"
                    :class="{ active: styleForm.backgroundPreset === preset.filename }"
                    @click="selectPreset(preset.filename)"
                  >
                    <img v-if="preset.dataUrl" :src="preset.dataUrl" class="preset-thumb" />
                    <div v-else class="preset-thumb-placeholder"></div>
                    <div v-if="styleForm.backgroundPreset === preset.filename" class="preset-check">&#10003;</div>
                  </div>
                </div>

                <!-- 分隔线 -->
                <div class="preset-divider"><span>或选择自定义图片</span></div>

                <!-- 自定义图片 -->
                <button class="btn-select-image" @click="selectBackgroundImage">
                  {{ styleForm.backgroundImage ? '更换图片' : '选择本地图片' }}
                </button>
                <div v-if="styleForm.backgroundImage && !styleForm.backgroundPreset" class="image-preview-hint">
                  已选择自定义图片
                </div>

                <!-- 不透明度和模糊度 -->
                <div class="form-row two-col">
                  <div class="form-field">
                    <label>图片不透明度 {{ Math.round(styleForm.backgroundImageOpacity * 100) }}%</label>
                    <input v-model.number="styleForm.backgroundImageOpacity" type="range" min="0.1" max="1" step="0.05" />
                  </div>
                  <div class="form-field">
                    <label>图片模糊度 {{ styleForm.backgroundImageBlur }}px</label>
                    <input v-model.number="styleForm.backgroundImageBlur" type="range" min="0" max="20" step="1" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 背景颜色 -->
            <div class="style-section">
              <div class="section-label">背景设置</div>
              <div class="form-row two-col">
                <div class="form-field">
                  <label>背景颜色</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.backgroundColor" type="color" class="color-picker" />
                    <input v-model="styleForm.backgroundColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="form-field">
                  <label>背景不透明度 {{ Math.round(styleForm.backgroundOpacity * 100) }}%</label>
                  <input v-model.number="styleForm.backgroundOpacity" type="range" min="0.3" max="1" step="0.05" />
                </div>
              </div>
              <div class="form-row two-col">
                <div class="form-field">
                  <label>边框颜色</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.borderColor" type="color" class="color-picker" />
                    <input v-model="styleForm.borderColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="form-field">
                  <label>边框不透明度 {{ Math.round(styleForm.borderOpacity * 100) }}%</label>
                  <input v-model.number="styleForm.borderOpacity" type="range" min="0" max="1" step="0.05" />
                </div>
              </div>
            </div>

            <!-- 字体设置 -->
            <div class="style-section">
              <div class="section-label">字体设置</div>
              <div class="form-row two-col">
                <div class="form-field">
                  <label>字体样式</label>
                  <select v-model="styleForm.fontFamily">
                    <option value="'Segoe UI', 'Microsoft YaHei', sans-serif">Segoe UI (默认)</option>
                    <option value="'PingFang SC', 'Microsoft YaHei', sans-serif">苹方 / 微软雅黑</option>
                    <option value="'DIN Alternate', 'Avenir Next', sans-serif">DIN (数字专用)</option>
                    <option value="'Consolas', 'SF Mono', monospace">等宽字体</option>
                    <option value="'Georgia', 'Times New Roman', serif">衬线字体</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>字体大小 {{ styleForm.fontSize }}px</label>
                  <input v-model.number="styleForm.fontSize" type="range" min="10" max="20" step="1" />
                </div>
              </div>
            </div>

            <!-- 主显示区颜色 -->
            <div class="style-section">
              <div class="section-label">主显示区颜色</div>
              <div class="color-grid">
                <div class="color-item">
                  <label>Token 数字</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.tokenNumberColor" type="color" class="color-picker" />
                    <input v-model="styleForm.tokenNumberColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>时间</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.timeColor" type="color" class="color-picker" />
                    <input v-model="styleForm.timeColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>本次消费</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.sessionCostColor" type="color" class="color-picker" />
                    <input v-model="styleForm.sessionCostColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>总余额</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.balanceColor" type="color" class="color-picker" />
                    <input v-model="styleForm.balanceColor" type="text" class="color-text" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 模型列表颜色 -->
            <div class="style-section">
              <div class="section-label">模型列表颜色</div>
              <div class="color-grid">
                <div class="color-item">
                  <label>模型名称</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.modelNameColor" type="color" class="color-picker" />
                    <input v-model="styleForm.modelNameColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>模型 Token</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.modelTokensColor" type="color" class="color-picker" />
                    <input v-model="styleForm.modelTokensColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>模型消费</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.modelCostColor" type="color" class="color-picker" />
                    <input v-model="styleForm.modelCostColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>模型余额</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.modelBalanceColor" type="color" class="color-picker" />
                    <input v-model="styleForm.modelBalanceColor" type="text" class="color-text" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 其他颜色 -->
            <div class="style-section">
              <div class="section-label">其他颜色</div>
              <div class="color-grid">
                <div class="color-item">
                  <label>标签文字</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.labelColor" type="color" class="color-picker" />
                    <input v-model="styleForm.labelColor" type="text" class="color-text" />
                  </div>
                </div>
                <div class="color-item">
                  <label>预警文字</label>
                  <div class="color-input-row">
                    <input v-model="styleForm.alertColor" type="color" class="color-picker" />
                    <input v-model="styleForm.alertColor" type="text" class="color-text" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 预览 -->
            <div class="style-section">
              <div class="section-label">实时预览</div>
              <div class="preview-box" :style="previewStyle">
                <div v-if="styleForm.backgroundType === 'image' && previewImageUrl" class="preview-image-layer"
                     :style="{
                       backgroundImage: `url(${previewImageUrl})`,
                       opacity: styleForm.backgroundImageOpacity,
                       filter: styleForm.backgroundImageBlur > 0 ? `blur(${styleForm.backgroundImageBlur}px)` : 'none'
                     }"></div>
                <div class="preview-content">
                <div class="preview-header">
                  <span class="preview-dot" :style="{ background: styleForm.tokenNumberColor }"></span>
                  <span :style="{ color: styleForm.labelColor, fontSize: '9px' }">LIVE :8000</span>
                  <span class="preview-close">✕</span>
                </div>
                <div class="preview-main">
                  <div class="preview-token" :style="{ color: styleForm.tokenNumberColor, fontSize: (styleForm.fontSize + 26) + 'px', fontFamily: styleForm.fontFamily }">1,234</div>
                </div>
                <div class="preview-model-name" :style="{ color: styleForm.modelNameColor, fontSize: '12px', fontFamily: styleForm.fontFamily }">DeepSeek V4-Flash</div>
                <div class="preview-time-bar">
                  <div class="preview-glass-item">
                    <span :style="{ color: styleForm.labelColor, fontSize: '8px' }">时间</span>
                    <span :style="{ color: styleForm.timeColor, fontSize: '12px', fontFamily: styleForm.fontFamily }">12:34:56</span>
                  </div>
                  <div class="preview-glass-divider"></div>
                  <div class="preview-glass-item">
                    <span :style="{ color: styleForm.labelColor, fontSize: '8px' }">今日消费</span>
                    <span :style="{ color: styleForm.sessionCostColor, fontSize: '12px', fontFamily: styleForm.fontFamily }">¥0.0523</span>
                  </div>
                  <div class="preview-glass-divider"></div>
                  <div class="preview-glass-item">
                    <span :style="{ color: styleForm.labelColor, fontSize: '8px' }">总余额</span>
                    <span :style="{ color: styleForm.balanceColor, fontSize: '12px', fontFamily: styleForm.fontFamily }">¥100.00</span>
                  </div>
                </div>
                </div>
              </div>
            </div>

            <div class="panel-actions" style="margin-top: 16px;">
              <button class="btn-primary" @click="saveStyle">
                <span class="btn-icon-inner">💾</span>
                <span>保存样式配置</span>
              </button>
              <button class="btn-secondary" @click="resetStyle">
                <span>恢复默认</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 历史记录 ========== -->
      <div v-if="activeTab === 'history'" class="tab-panel">
        <div class="panel-card">
          <div class="card-title">
            <span class="card-icon">📜</span>
            <span>会话历史记录</span>
            <span class="card-badge">{{ logs.length }} 条</span>
          </div>
          <div class="card-body">
            <div v-if="logs.length === 0" class="empty-state">
              <div class="empty-icon">📭</div>
              <div class="empty-text">暂无历史记录</div>
              <div class="empty-sub">使用中转服务后，每次会话结束会自动生成记录</div>
            </div>
            <div v-else class="log-list">
              <div
                v-for="log in logs"
                :key="log.filename"
                class="log-item"
                :class="{ expanded: expandedLog === log.filename }"
              >
                <div class="log-header" @click="toggleLog(log.filename)">
                  <div class="log-date">
                    <span class="log-date-icon">📅</span>
                    <span class="log-date-text">{{ log.date }}</span>
                    <span class="log-time">{{ log.time }}</span>
                  </div>
                  <div class="log-summary">
                    <span class="log-badge">{{ log.models.length }} 个模型</span>
                    <span class="log-tokens">{{ formatNumber(log.totalTokens) }} tokens</span>
                    <span class="log-cost">¥{{ log.totalCost.toFixed(4) }}</span>
                  </div>
                  <div class="log-expand">
                    <span class="expand-icon" :class="{ open: expandedLog === log.filename }">▼</span>
                  </div>
                </div>
                <div v-if="expandedLog === log.filename" class="log-detail">
                  <div class="detail-table">
                    <div class="detail-header">
                      <span>模型</span>
                      <span>输入 Tokens</span>
                      <span>输出 Tokens</span>
                      <span>总计</span>
                      <span>消费</span>
                      <span>余额</span>
                    </div>
                    <div
                      v-for="model in log.models"
                      :key="model.name"
                      class="detail-row"
                    >
                      <span class="detail-name">{{ model.name }}</span>
                      <span class="detail-num">{{ formatNumber(model.promptTokens) }}</span>
                      <span class="detail-num">{{ formatNumber(model.completionTokens) }}</span>
                      <span class="detail-num highlight">{{ formatNumber(model.totalTokens) }}</span>
                      <span class="detail-cost">¥{{ model.cost.toFixed(4) }}</span>
                      <span class="detail-balance">¥{{ model.balance.toFixed(2) }}</span>
                    </div>
                    <div class="detail-footer">
                      <span>合计</span>
                      <span class="detail-num">{{ formatNumber(log.totalPromptTokens) }}</span>
                      <span class="detail-num">{{ formatNumber(log.totalCompletionTokens) }}</span>
                      <span class="detail-num highlight">{{ formatNumber(log.totalTokens) }}</span>
                      <span class="detail-cost">¥{{ log.totalCost.toFixed(4) }}</span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型编辑弹窗 -->
    <div v-if="showAddModel" class="modal-mask" @click.self="showAddModel = false">
      <div class="modal">
        <div class="modal-header">
          <h4>{{ editingIdx >= 0 ? '编辑模型' : '添加模型' }}</h4>
          <button class="modal-close" @click="showAddModel = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>模型 ID <span class="req">*</span></label>
            <input v-model="editingModel.id" type="text" placeholder="请求中的模型名称，如 deepseek-chat" />
          </div>
          <div class="form-group">
            <label>显示名称</label>
            <input v-model="editingModel.name" type="text" placeholder="如 DeepSeek Chat" />
          </div>
          <div class="form-group">
            <label>API 格式 <span class="req">*</span></label>
            <select v-model="editingModel.apiFormat">
              <option value="openai">OpenAI (/v1/chat/completions)</option>
              <option value="anthropic">Anthropic (/v1/messages)</option>
            </select>
          </div>
          <div class="form-group">
            <label>官方请求地址 <span class="req">*</span></label>
            <input v-model="editingModel.apiBase" type="text"
              :placeholder="editingModel.apiFormat === 'anthropic' ? '如 https://api.anthropic.com (不含路径)' : '如 https://api.deepseek.com (不含路径)'" />
            <div class="field-hint">💡 建议只填域名（不含 /v1/... 路径），系统会自动附加正确的请求路径</div>
          </div>
          <div class="form-group">
            <label>API Key <span class="optional">(可选，留空则使用请求中的 Key)</span></label>
            <input v-model="editingModel.apiKey" type="password" placeholder="留空则透传请求中的 Authorization" />
          </div>
          <div class="form-row two-col">
            <div class="form-field">
              <label>输入价格 (¥/1K tokens)</label>
              <input v-model.number="editingModel.inputPrice" type="number" step="0.0001" min="0" />
            </div>
            <div class="form-field">
              <label>输出价格 (¥/1K tokens)</label>
              <input v-model.number="editingModel.outputPrice" type="number" step="0.0001" min="0" />
            </div>
          </div>
          <div class="form-row two-col">
            <div class="form-field">
              <label>初始余额 (元)</label>
              <input v-model.number="editingModel.initialBalance" type="number" min="0" step="1" />
            </div>
            <div class="form-field">
              <label>预警阈值 (元)</label>
              <input v-model.number="editingModel.alertThreshold" type="number" min="0" step="1" />
            </div>
          </div>
          <div class="form-group">
            <label>余额查询地址 <span class="optional">(可选)</span></label>
            <input v-model="editingModel.balanceQueryUrl" type="text" placeholder="官方余额接口，如 https://api.deepseek.com/user/balance" />
          </div>
          <div class="form-group">
            <label>余额查询密钥 <span class="optional">(留空则使用上方 API Key)</span></label>
            <input v-model="editingModel.balanceQueryKey" type="password" placeholder="留空则使用模型的 API Key" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAddModel = false">取消</button>
          <button class="btn-save" @click="onAddModel" :disabled="!editingModel.id || !editingModel.apiBase">
            {{ editingIdx >= 0 ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, toRaw, computed } from 'vue'
import type { RelaySettings, ModelEntry, FloatingStyleConfig } from '../../shared/relay-types'
import { DEFAULT_RELAY_SETTINGS, DEFAULT_FLOATING_STYLE } from '../../shared/relay-types'

// ========== Tabs ==========
const tabs = [
  { key: 'models', label: '模型配置', icon: '🧠' },
  { key: 'style', label: '样式配置', icon: '🎨' },
  { key: 'history', label: '历史记录', icon: '📜' }
]
const activeTab = ref('models')

// ========== Relay Settings ==========
const form = reactive<RelaySettings>({ ...DEFAULT_RELAY_SETTINGS })
const relayRunning = ref(false)
const relayPort = ref(8001)
const showAddModel = ref(false)
const editingIdx = ref(-1)

const editingModel = reactive<ModelEntry>({
  id: '', name: '', apiFormat: 'openai', apiBase: '', apiKey: '',
  inputPrice: 0, outputPrice: 0, enabled: true,
  initialBalance: 0, alertThreshold: 0,
  balanceQueryUrl: '', balanceQueryKey: ''
})

// ========== Style Config ==========
const styleForm = reactive<FloatingStyleConfig>({ ...DEFAULT_FLOATING_STYLE })

const backgroundTypes = [
  { value: 'solid', label: '纯色', previewStyle: { background: 'linear-gradient(145deg, #12161e, #0c1018)' } },
  { value: 'image', label: '图片背景', previewStyle: { background: 'linear-gradient(45deg, #667eea, #764ba2)' } }
]

const presetImages = ref<{ filename: string; dataUrl: string }[]>([])
const customImageDataUrl = ref('')

// 预设图片查找表
const presetMap = computed(() => {
  const map = new Map<string, string>()
  for (const p of presetImages.value) {
    map.set(p.filename, p.dataUrl)
  }
  return map
})

// 当前预览用的图片 data URL
const previewImageUrl = computed(() => {
  if (styleForm.backgroundType !== 'image') return ''
  if (styleForm.backgroundPreset) {
    return presetMap.value.get(styleForm.backgroundPreset) || ''
  }
  if (styleForm.backgroundImage) {
    return customImageDataUrl.value
  }
  return ''
})

function selectPreset(filename: string) {
  styleForm.backgroundPreset = filename
  styleForm.backgroundImage = ''
  customImageDataUrl.value = ''
}

async function selectBackgroundImage() {
  const result = await window.electronAPI.selectBackgroundImage()
  if (result) {
    styleForm.backgroundImage = result
    styleForm.backgroundPreset = ''
    // 重新加载样式以获取 data URL 用于预览
    const freshStyle = await window.electronAPI.getFloatingStyle()
    if (freshStyle && freshStyle.backgroundImage) {
      customImageDataUrl.value = freshStyle.backgroundImage
    }
  }
}

const previewStyle = computed(() => {
  const bg = hexToRgba(styleForm.backgroundColor, styleForm.backgroundOpacity)
  const border = hexToRgba(styleForm.borderColor, styleForm.borderOpacity)
  return {
    background: bg,
    fontFamily: styleForm.fontFamily,
    borderRadius: '12px',
    border: `1px solid ${border}`,
    position: 'relative' as const,
    overflow: 'hidden' as const
  }
})

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ========== History Logs ==========
const logs = ref<any[]>([])
const expandedLog = ref<string | null>(null)

function toggleLog(filename: string) {
  expandedLog.value = expandedLog.value === filename ? null : filename
}

function formatNumber(n: number): string {
  return String(Math.round(n))
}

// ========== Lifecycle ==========
onMounted(async () => {
  const saved = await window.electronAPI.getSettings()
  if (saved && saved.models) {
    Object.assign(form, saved)
    form.autoStart = !!form.autoStart
    form.models = form.models.map((m: ModelEntry) => ({ ...m, enabled: m.enabled !== false }))
  }
  form.autoStart = await window.electronAPI.getAutoStart()

  const status = await window.electronAPI.getRelayStatus()
  relayRunning.value = status.running
  relayPort.value = status.port || form.port

  // Load style
  const savedStyle = await window.electronAPI.getFloatingStyle()
  if (savedStyle) {
    Object.assign(styleForm, savedStyle)
    // 如果有自定义图片，保存其 data URL 用于预览
    if (savedStyle.backgroundImage && savedStyle.backgroundImage.startsWith('data:')) {
      customImageDataUrl.value = savedStyle.backgroundImage
    }
  }

  // Load preset images
  try {
    presetImages.value = await window.electronAPI.getPresetBackgrounds()
  } catch {
    presetImages.value = []
  }

  // Load logs
  loadLogs()
})

async function loadLogs() {
  try {
    logs.value = await window.electronAPI.listSessionLogs()
  } catch (e) {
    logs.value = []
  }
}

// ========== Model CRUD ==========
function openModelModal(idx?: number) {
  if (idx !== undefined) {
    editingIdx.value = idx
    Object.assign(editingModel, { ...form.models[idx] })
  } else {
    editingIdx.value = -1
    resetEditingModel()
  }
  showAddModel.value = true
}

function onAddModel() {
  if (!editingModel.id || !editingModel.apiBase) return
  if (editingIdx.value >= 0) {
    form.models[editingIdx.value] = { ...editingModel }
    editingIdx.value = -1
  } else {
    if (form.models.find(m => m.id === editingModel.id)) {
      alert('模型 ID 已存在')
      return
    }
    form.models.push({ ...editingModel })
  }
  showAddModel.value = false
  resetEditingModel()
}

function onEditModel(idx: number) {
  openModelModal(idx)
}

function onRemoveModel(idx: number) {
  if (confirm(`删除模型「${form.models[idx].name || form.models[idx].id}」？`)) {
    form.models.splice(idx, 1)
  }
}

function toggleModel(idx: number) {
  form.models[idx].enabled = form.models[idx].enabled === false ? true : false
}

function resetEditingModel() {
  editingIdx.value = -1
  Object.assign(editingModel, {
    id: '', name: '', apiFormat: 'openai', apiBase: '', apiKey: '',
    inputPrice: 0, outputPrice: 0, enabled: true,
    initialBalance: 0, alertThreshold: 0,
    balanceQueryUrl: '', balanceQueryKey: ''
  })
}

// ========== Relay Control ==========
async function onStartRelay() {
  try {
    const result = await window.electronAPI.startRelay(JSON.parse(JSON.stringify(toRaw(form))))
    if (result.success) {
      relayRunning.value = true
      relayPort.value = result.port
    } else {
      alert('启动失败: ' + (result.error || '未知错误'))
    }
  } catch (e: any) {
    alert('启动失败: ' + (e.message || '未知错误'))
  }
}

async function onStopRelay() {
  await window.electronAPI.stopRelay()
  relayRunning.value = false
}

// ========== Save & Start ==========
async function onSaveAndStart() {
  if (form.models.length === 0) { alert('请至少添加一个模型'); return }
  const plain = JSON.parse(JSON.stringify(toRaw(form)))
  try {
    await window.electronAPI.setSettings(plain)
    await window.electronAPI.setAutoStart(form.autoStart)
    const result = await window.electronAPI.startRelay(plain)
    if (result.success) {
      relayRunning.value = true
      relayPort.value = result.port
    } else {
      alert('中转服务启动失败: ' + (result.error || '未知错误'))
      return
    }
  } catch (e: any) {
    alert('操作失败: ' + (e.message || '未知错误'))
    return
  }
  window.electronAPI.openFloatingWindow()
  window.close()
}

// ========== Style Actions ==========
async function saveStyle() {
  const plain = JSON.parse(JSON.stringify(toRaw(styleForm)))
  await window.electronAPI.setFloatingStyle(plain)
  alert('样式配置已保存')
}

function resetStyle() {
  Object.assign(styleForm, DEFAULT_FLOATING_STYLE)
}
</script>

<style>
/* ============================================================
   基础 & 主题
   ============================================================ */
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-primary: #0d0f12;
  --bg-secondary: #14171c;
  --bg-tertiary: #1a1e24;
  --bg-hover: #222830;
  --border-color: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.1);
  --text-primary: #e8eaed;
  --text-secondary: #9aa0a6;
  --text-muted: #5f6368;
  --accent-blue: #4a90d9;
  --accent-blue-hover: #5aa0e9;
  --accent-green: #5cb85c;
  --accent-red: #e06060;
  --accent-orange: #e0b060;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}

body {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
}

/* ============================================================
   布局
   ============================================================ */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 顶部标题栏 */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  color: var(--accent-blue);
  display: flex;
  align-items: center;
}

.header-title h1 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.header-version {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 6px;
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 10px;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
  transition: all 0.2s;
}

.status-pill.running {
  background: rgba(92,184,92,0.08);
  border-color: rgba(92,184,92,0.2);
  color: var(--accent-green);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-pill.running .status-dot {
  background: var(--accent-green);
  box-shadow: 0 0 6px rgba(92,184,92,0.4);
}

/* ============================================================
   Tab 导航
   ============================================================ */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 8px 20px 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  position: relative;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,0.02);
}

.tab-btn.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
  background: linear-gradient(180deg, rgba(74,144,217,0.06) 0%, transparent 100%);
}

.tab-icon {
  font-size: 14px;
}

/* ============================================================
   内容区域
   ============================================================ */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 20px;
}

.content::-webkit-scrollbar {
  width: 4px;
}

.content::-webkit-scrollbar-track {
  background: transparent;
}

.content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
}

.tab-panel {
  max-width: 640px;
  margin: 0 auto;
}

/* ============================================================
   卡片
   ============================================================ */
.panel-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
  overflow: hidden;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
}

.card-icon {
  font-size: 15px;
  opacity: 0.8;
}

.card-badge {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 400;
}

.card-body {
  padding: 14px 16px;
}

/* ============================================================
   表单元素
   ============================================================ */
.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.form-row.two-col > .form-field {
  flex: 1;
}

.form-field {
  margin-bottom: 8px;
}

.form-field label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-field input[type="text"],
.form-field input[type="number"],
.form-field input[type="password"],
.form-field select {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.form-field input:focus,
.form-field select:focus {
  border-color: var(--accent-blue);
}

.form-field input::placeholder {
  color: var(--text-muted);
}

.form-field select {
  cursor: pointer;
}

.form-field select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.form-field input[type="range"] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
}

.form-field input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent-blue);
  cursor: pointer;
  border: 2px solid var(--bg-secondary);
}

.toggle-field {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.toggle-field .toggle {
  margin-top: 4px;
}

/* Toggle */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-hover);
  border-radius: 22px;
  transition: background 0.2s;
  border: 1px solid var(--border-color);
}

.slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}

.toggle input:checked + .slider {
  background: rgba(74,144,217,0.2);
  border-color: rgba(74,144,217,0.3);
}

.toggle input:checked + .slider::before {
  transform: translateX(18px);
  background: var(--accent-blue);
}

/* Form group (modal) */
.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--accent-blue);
}

.req { color: var(--accent-red); }
.optional { color: var(--text-muted); font-weight: normal; }

.field-hint {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  padding: 6px 8px;
  background: rgba(224,176,96,0.06);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--accent-orange);
}

/* ============================================================
   按钮
   ============================================================ */
.btn-add-sm {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid var(--accent-blue);
  border-radius: var(--radius-sm);
  background: rgba(74,144,217,0.1);
  color: var(--accent-blue);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.btn-add-sm:hover {
  background: rgba(74,144,217,0.2);
}

.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px;
  background: linear-gradient(135deg, var(--accent-blue) 0%, #3a7bc8 100%);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--accent-blue-hover) 0%, #4a8bd8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74,144,217,0.25);
}

.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 20px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-icon:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-icon.danger:hover {
  border-color: rgba(224,96,96,0.3);
  color: var(--accent-red);
  background: rgba(224,96,96,0.06);
}

.btn-cancel {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-cancel:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.btn-save {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent-blue);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-save:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent-blue-hover);
}

.panel-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-actions .btn-primary + .btn-secondary {
  width: 100%;
}

.hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}

.hint code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--accent-blue);
}

/* ============================================================
   空状态
   ============================================================ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-sub {
  font-size: 12px;
  color: var(--text-muted);
}

/* ============================================================
   模型列表
   ============================================================ */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: all 0.15s;
}

.model-card:hover {
  border-color: var(--border-hover);
}

.model-card.disabled {
  opacity: 0.45;
}

.model-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.model-display-name {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(74,144,217,0.1);
  color: var(--accent-blue);
  border: 1px solid rgba(74,144,217,0.15);
  white-space: nowrap;
  flex-shrink: 0;
}

.tag.anthropic {
  background: rgba(217,90,122,0.08);
  color: #d95a7a;
  border-color: rgba(217,90,122,0.15);
}

.tag-green {
  background: rgba(92,184,92,0.08);
  color: var(--accent-green);
  border-color: rgba(92,184,92,0.15);
}

.model-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.model-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-meta-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-label {
  font-size: 11px;
  color: var(--text-muted);
}

.meta-value {
  font-size: 11px;
  color: var(--text-secondary);
}

.meta-value.mono {
  font-family: 'Consolas', monospace;
}

.meta-value.price {
  color: var(--accent-orange);
}

.key-mask {
  font-size: 10px;
  color: var(--text-muted);
}

/* Toggle SM */
.toggle-sm {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  width: 28px;
  height: 16px;
  border-radius: 16px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  transition: background 0.2s;
  position: relative;
  flex-shrink: 0;
}

.toggle-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-muted);
  position: absolute;
  left: 1px;
  transition: transform 0.2s, background 0.2s;
}

.toggle-dot.on {
  transform: translateX(12px);
  background: var(--accent-green);
}

.toggle-sm:has(.on) {
  background: rgba(92,184,92,0.15);
  border-color: rgba(92,184,92,0.2);
}

/* ============================================================
   样式配置
   ============================================================ */
.style-section {
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.style-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.color-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  padding: 2px;
  -webkit-appearance: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border-radius: 3px;
  border: none;
}

.color-text {
  flex: 1;
  font-family: 'Consolas', monospace;
  font-size: 12px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.color-item label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

/* 预览框 */
.preview-box {
  padding: 12px;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 160px;
  position: relative;
  overflow: hidden;
}

.preview-image-layer {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  pointer-events: none;
}

.preview-content {
  position: relative;
  z-index: 1;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.preview-close {
  margin-left: auto;
  font-size: 10px;
  opacity: 0.5;
}

.preview-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  padding: 8px;
}

.preview-token {
  font-weight: 500;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.preview-model-name {
  text-align: center;
  opacity: 0.7;
  letter-spacing: 0.5px;
}

.preview-time-bar {
  display: flex;
  align-items: stretch;
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.03) 100%);
  border-top: 1px solid rgba(255,255,255,0.1);
  border-radius: 0 0 8px 8px;
}

.preview-glass-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.preview-glass-divider {
  width: 1px;
  background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent 100%);
  align-self: stretch;
}

/* 背景类型选择 */
.background-type-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.bg-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.bg-type-card:hover {
  border-color: var(--border-hover);
  background: rgba(255,255,255,0.02);
}

.bg-type-card.active {
  border-color: var(--accent-blue);
  background: rgba(74,144,217,0.08);
}

.bg-preview {
  width: 100%;
  height: 40px;
  border-radius: 6px;
}

.bg-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.image-options {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.btn-select-image {
  width: 100%;
  padding: 8px;
  background: rgba(74,144,217,0.1);
  border: 1px solid rgba(74,144,217,0.3);
  border-radius: var(--radius-sm);
  color: var(--accent-blue);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  margin-bottom: 10px;
}

.btn-select-image:hover {
  background: rgba(74,144,217,0.2);
}

.image-preview-hint {
  font-size: 11px;
  color: var(--accent-green);
  margin-bottom: 10px;
  text-align: center;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.preset-card {
  position: relative;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border-color);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  aspect-ratio: 4/3;
}

.preset-card:hover {
  border-color: var(--border-hover);
}

.preset-card.active {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(74,144,217,0.2);
}

.preset-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preset-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
}

.preset-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: var(--accent-blue);
  border-radius: 50%;
  color: white;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
  color: var(--text-muted);
  font-size: 11px;
}

.preset-divider::before,
.preset-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

/* ============================================================
   历史记录
   ============================================================ */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color 0.15s;
}

.log-item:hover {
  border-color: var(--border-hover);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.log-header:hover {
  background: var(--bg-hover);
}

.log-date {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.log-date-icon {
  font-size: 13px;
  opacity: 0.6;
}

.log-date-text {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.log-time {
  font-size: 12px;
  color: var(--text-muted);
}

.log-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.log-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.log-tokens {
  font-size: 12px;
  color: var(--accent-green);
  font-family: 'Consolas', monospace;
}

.log-cost {
  font-size: 12px;
  color: var(--accent-orange);
  font-family: 'Consolas', monospace;
  min-width: 70px;
  text-align: right;
}

.log-expand {
  flex-shrink: 0;
}

.expand-icon {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
  display: inline-block;
}

.expand-icon.open {
  transform: rotate(180deg);
}

.log-detail {
  padding: 0 14px 14px;
  border-top: 1px solid var(--border-color);
}

.detail-table {
  margin-top: 10px;
}

.detail-header,
.detail-row,
.detail-footer {
  display: grid;
  grid-template-columns: 1fr 90px 90px 80px 80px 70px;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  font-size: 12px;
}

.detail-header {
  color: var(--text-muted);
  font-size: 11px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
  margin-bottom: 4px;
}

.detail-row {
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.detail-row:hover {
  background: var(--bg-hover);
}

.detail-footer {
  color: var(--text-primary);
  font-weight: 600;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
  padding-top: 8px;
}

.detail-name {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-num {
  font-family: 'Consolas', monospace;
  text-align: right;
}

.detail-num.highlight {
  color: var(--accent-green);
}

.detail-cost {
  font-family: 'Consolas', monospace;
  text-align: right;
  color: var(--accent-orange);
}

.detail-balance {
  font-family: 'Consolas', monospace;
  text-align: right;
  color: var(--accent-green);
}

/* ============================================================
   弹窗
   ============================================================ */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 460px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px 18px;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 0 18px 16px;
}

/* Scrollbar for modal */
.modal::-webkit-scrollbar {
  width: 4px;
}

.modal::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
}
</style>
