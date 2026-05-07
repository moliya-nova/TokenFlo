# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 沟通偏好

- 使用中文进行回答和交流

## 项目概述

TokenFloatingWindow 是一个本地 API 中转网关 + 实时用量监控的桌面工具。核心功能：
- 本地 HTTP 中转服务，代理 OpenAI 和 Anthropic 格式的 API 请求
- 实时统计每个模型的 Token 用量和消费金额
- 置顶悬浮窗展示统计数据（本次/今日/历史 Token 数、消费、余额）
- 余额预警机制和自动同步
- 系统托盘常驻，支持开机自启

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式（含热更新）
npm run dev

# 生产构建
npm run build

# 打包 Windows 安装包（NSIS + 便携版）
npm run package:win
```

**环境要求**: Node.js >= 18, npm >= 9

**打包产物**（输出到 `dist/`）：
- `TokenFloatingWindow Setup x.x.x.exe` — NSIS 安装包（x64）
- `TokenFloatingWindow-portable-x.x.x.exe` — 便携版（x64）

## 技术栈

| 项 | 选型 |
|---|---|
| 前端框架 | Vue 3 (Composition API, `<script setup>`) |
| 桌面壳 | Electron 28 |
| 构建工具 | electron-vite 2.1 + Vite 5 |
| 状态管理 | Pinia |
| 打包工具 | electron-builder (NSIS + Portable) |
| 开发语言 | TypeScript |

## 架构设计

### 三进程架构

```
主进程 (Main Process)          预加载 (Preload)           渲染进程 (Renderer)
┌─────────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ electron/main.ts    │    │ preload/          │    │ src/windows/         │
│  - 窗口管理         │◄──►│  settings.ts      │◄──►│  settings/App.vue    │
│  - 系统托盘         │    │  floating.ts      │◄──►│  floating/App.vue    │
│  - IPC 处理         │    │  (contextBridge)  │    │                      │
│  - 中转服务         │    └──────────────────┘    └──────────────────────┘
│  - 统计引擎         │
│  - 余额查询         │
└─────────────────────┘
```

### 核心模块

**HTTP 中转服务 (`electron/relay/server.ts`)**
- 使用 Node.js 原生 `http.createServer` 在 `127.0.0.1` 监听
- 路由: `POST /v1/chat/completions`（OpenAI）、`POST /v1/messages`（Anthropic）、`GET /v1/models`、`GET /health`

**统计引擎 (`electron/relay/stats.ts`)**
- 三层统计维度: 本次会话 (session)、今日 (today)、历史总计 (total)
- 按模型独立统计 Token 数、消费、余额
- 消费计算: `(promptTokens / 1000) * inputPrice + (completionTokens / 1000) * outputPrice`
- 跨日自动重置今日统计

**余额查询器 (`electron/relay/balance-checker.ts`)**
- 每 60 秒轮询查询官方余额
- 支持多种 API 响应格式自动识别

**数据持久化 (`electron/relay/persistence.ts`)**
- 数据存储目录: `~/.tokenflo/`
  - `settings.json` — 当前配置
  - `configs.json` — 配置方案
  - `data/historical.json` — 历史总计数据
  - `data/{modelId}/{date}.json` — 每模型每日数据

**IPC 通信 (`electron/ipc/`)**
- `channels.ts`: 定义所有 IPC 通道常量
- `handlers.ts`: 注册所有 IPC 处理函数
- Preload 脚本通过 `contextBridge.exposeInMainWorld` 暴露安全 API

### 双窗口设计

**设置窗口** (`src/windows/settings/App.vue`):
- 520x680 固定尺寸
- 功能: 模型管理、中转端口配置、配置方案管理、服务启停
- 支持 OpenAI 和 Anthropic 两种 API 格式

**悬浮窗** (`src/windows/floating/App.vue`):
- 可拖拽、可调整大小、始终置顶、无边框
- 展示实时统计数据，通过 IPC 接收主进程推送
- 深色半透明毛玻璃风格 UI

### 数据流

```
客户端请求 → 中转服务(server.ts) → 代理到目标API → 获取响应
                                       ↓
                                 统计引擎(stats.ts) 记录用量
                                       ↓
                              通过 IPC 推送到悬浮窗(App.vue)
```

## 类型定义

核心类型定义在 `src/shared/relay-types.ts`，包括 `ModelEntry`、`RelaySettings`、`RelayStats` 等。

## 注意事项

- 项目使用 electron-vite 构建，主进程代码在 `electron/`，渲染进程代码在 `src/`
- 所有 IPC 通道常量集中在 `electron/ipc/channels.ts` 管理
- 数据持久化使用文件系统，非数据库
- 悬浮窗的关闭按钮会退出整个应用，而非仅关闭悬浮窗
