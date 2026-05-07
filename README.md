# TokenFlo

> 本地 AI API 中转网关 + 实时用量悬浮窗监控 | A local AI API relay gateway with real-time usage monitoring overlay

TokenFlo 是一个基于 Electron 的桌面工具，为 AI 开发者提供本地 API 中转服务和实时消费监控。它能够代理 OpenAI / Anthropic 格式的 API 请求，精确统计每个模型的 Token 用量和消费金额，并通过一个可定制的悬浮窗实时展示所有数据。

## 功能亮点

- **多模型 API 中转** — 本地 HTTP 代理，统一管理多个 AI 模型的 API 请求
- **实时悬浮窗监控** — 置顶悬浮窗展示 Token 用量、消费金额、余额等数据
- **三层统计维度** — 本次会话 / 今日累计 / 历史总计，按模型独立统计
- **余额预警机制** — 按模型设置预警阈值，余额不足自动提醒
- **自动余额同步** — 配置官方余额查询接口，自动同步真实余额
- **高度可定制 UI** — 5 种背景样式（纯色 / 图片 / 星空 / 极光 / 粒子），丰富的颜色和字体配置
- **系统托盘常驻** — 支持开机自启，最小化到托盘不占用任务栏
- **多配置方案** — 保存、加载、删除多套配置方案，快速切换不同场景

## 支持的 API 格式

| 格式 | 端点 |
|------|------|
| OpenAI | `/v1/chat/completions`, `/chat/completions` |
| Anthropic | `/v1/messages`, `/messages` |
| 通用 | `/v1/models` (模型列表), `/health` (健康检查) |

支持 SSE 流式响应透传。

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- Windows 10/11 (x64)

### 开发模式

```bash
git clone https://github.com/moliya-nova/TokenFlo.git
cd TokenFlo
npm install
npm run dev
```

### 生产构建

```bash
npm run build          # 构建项目
npm run package:win    # 打包 Windows 安装包
```

打包产物（输出到 `dist/`）：

- `TokenFlo Setup x.x.x.exe` — NSIS 安装包，支持自定义安装目录
- `TokenFlo-portable-x.x.x.exe` — 便携版，双击即用

## 使用指南

### 1. 配置模型

启动应用后在设置窗口中点击 **"+ 添加模型"**，填写：

| 字段 | 说明 |
|------|------|
| 模型 ID | 请求中的模型名称，如 `deepseek-chat` |
| 显示名称 | 悬浮窗中显示的名称 |
| API 格式 | OpenAI 或 Anthropic |
| 官方请求地址 | API 服务域名，如 `https://api.deepseek.com` |
| API Key | 留空则透传客户端请求中的 Key |
| 输入/输出价格 | 元/千 tokens，用于计算消费 |
| 初始余额 / 预警阈值 | 余额管理和预警 |

### 2. 启动中转服务

点击 **"保存并启动中转 + 悬浮窗"**，应用会启动 HTTP 中转服务并打开悬浮窗。

### 3. 配置客户端

将客户端的 API 地址改为本地中转地址：

```
http://127.0.0.1:<端口>/v1
```

默认端口为 `8001`，可在设置中自定义（1024-65535）。

### 4. 悬浮窗操作

- **拖拽移动** — 拖动悬浮窗顶部区域
- **调整大小** — 拖拽窗口边缘
- **始终置顶** — 悬浮窗始终在最上层
- **关闭按钮** — 右上角 X 退出整个应用

系统托盘右键菜单可重新打开设置、关闭悬浮窗、重启中转或退出应用。

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 主进程                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  HTTP 中转    │  │  统计引擎     │  │  余额查询器       │  │
│  │  server.ts    │  │  stats.ts    │  │  balance-checker  │  │
│  │  proxy.ts     │  │              │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────┘  │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  │ IPC                                       │
├──────────────────┼──────────────────────────────────────────┤
│                  ▼                                           │
│  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   悬浮窗 (floating)    │  │   设置窗口 (settings)      │  │
│  │   实时数据展示         │  │   模型/样式/历史管理       │  │
│  └───────────────────────┘  └────────────────────────────┘  │
│                     渲染进程                                  │
└─────────────────────────────────────────────────────────────┘
```

**数据流**: 客户端请求 → 中转服务代理 → 统计引擎记录 → IPC 推送 → 悬浮窗实时展示

## 项目结构

```
TokenFlo/
├── electron/                      # 主进程
│   ├── main.ts                    # 窗口管理、系统托盘、IPC 处理
│   ├── preload/                   # contextBridge 安全 API
│   │   ├── settings.ts
│   │   └── floating.ts
│   ├── relay/                     # 中转服务核心
│   │   ├── server.ts              # HTTP 监听与路由
│   │   ├── proxy.ts               # 请求代理（支持 SSE 流式）
│   │   ├── stats.ts               # 三层统计引擎
│   │   ├── balance-checker.ts     # 余额轮询查询
│   │   └── persistence.ts         # 文件系统持久化
│   └── ipc/
│       ├── channels.ts            # IPC 通道常量
│       └── handlers.ts            # IPC 处理函数
├── src/                           # 渲染进程
│   ├── shared/
│   │   └── relay-types.ts         # 核心类型定义
│   └── windows/
│       ├── floating/              # 悬浮窗应用
│       │   ├── App.vue            # 主界面（毛玻璃风格 + 滚轮动画）
│       │   └── backgrounds/       # 动态背景组件（星空/极光/粒子）
│       └── settings/              # 设置面板应用
│           └── App.vue            # 模型配置 / 样式配置 / 历史记录
├── resources/                     # 应用图标
├── electron-builder.yml           # 打包配置
├── electron.vite.config.ts        # 构建配置
└── package.json
```

## 数据存储

数据存储在 `~/.tokenflo/` 目录：

```
~/.tokenflo/
├── settings.json          # 当前配置
├── configs.json           # 多套配置方案
├── sessions/              # 会话日志
└── data/
    ├── historical.json    # 历史总计数据
    └── {modelId}/
        └── {date}.json   # 每模型每日数据
```

## 技术栈

| 项 | 选型 |
|---|---|
| 前端框架 | Vue 3 (Composition API) |
| 桌面框架 | Electron 28 |
| 构建工具 | electron-vite 2.1 + Vite 5 |
| 打包工具 | electron-builder (NSIS + Portable) |
| 开发语言 | TypeScript |

## 许可证

[MIT License](LICENSE)
