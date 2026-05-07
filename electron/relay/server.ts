import { createServer, type Server } from 'http'
import type { RelaySettings, ModelEntry } from '../../src/shared/relay-types'
import { handleProxyRequest } from './proxy'
import { loadRelaySettings, saveRelaySettings } from './persistence'
import { pushServerState } from './stats'

let server: Server | null = null
let currentModels: ModelEntry[] = []

// ============================================================
// 路由表
// ============================================================

const ROUTES: Record<string, (req: any, res: any) => void> = {}

// 在 setup 中注册

// ============================================================
// 启动 / 停止
// ============================================================

export function startServer(settings: RelaySettings): Promise<{ success: boolean; port: number; error?: string }> {
  return new Promise((resolve) => {
    if (server) {
      resolve({ success: true, port: getListeningPort() })
      return
    }

    currentModels = settings.models.filter(m => m.enabled !== false)
    console.log(`[Server] Starting with ${currentModels.length} enabled models:`, currentModels.map(m => `${m.id} (${m.name})`))

    server = createServer(async (req, res) => {
      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = req.url || '/'
      const pathname = url.split('?')[0] // 忽略查询参数
      console.log(`[Server] ${req.method} ${url}`)

      try {
        // POST /v1/chat/completions (OpenAI) 或 /v1/messages (Anthropic)
        if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions' || pathname === '/v1/messages' || pathname === '/messages')) {
          // 传递 pathname 而不是完整 url，因为 buildTargetUrl 不需要查询参数
          // 但我们需要保持 req.url 不变，因为 proxy 可能需要
          await handleProxyRequest(req, res, currentModels)
          return
        }

        // GET /v1/models
        if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
          const modelList = currentModels.map(m => ({
            id: m.id,
            object: 'model',
            created: 0,
            owned_by: 'user'
          }))
          console.log(`[Server] Returning ${modelList.length} models:`, modelList.map(m => m.id))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            object: 'list',
            data: modelList
          }))
          return
        }

        // GET /health
        if (req.method === 'GET' && url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            status: 'ok',
            models: currentModels.length,
            uptime: process.uptime()
          }))
          return
        }

        // GET /
        if (req.method === 'GET' && url === '/') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            name: 'TokenFloatingWindow Relay',
            version: '2.0.0',
            endpoint: '/v1/chat/completions',
            models: currentModels.map(m => m.id),
            health: '/health'
          }))
          return
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: `Not found: ${req.method} ${url}`, type: 'not_found' } }))
      } catch (e: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: `Internal error: ${e.message}` } }))
        }
      }
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ success: false, port: settings.port, error: `端口 ${settings.port} 已被占用，请在设置中修改端口号` })
      } else {
        resolve({ success: false, port: settings.port, error: err.message })
      }
      server = null
    })

    server.listen(settings.port, '127.0.0.1', () => {
      console.log(`[Relay] Server started on http://127.0.0.1:${settings.port}`)
      pushServerState(true, settings.port)
      resolve({ success: true, port: settings.port })
    })
  })
}

export function stopServer(): void {
  if (server) {
    server.close()
    server = null
    console.log('[Relay] Server stopped')
    pushServerState(false, 0)
  }
}

export function restartServer(settings: RelaySettings): Promise<{ success: boolean; port: number; error?: string }> {
  stopServer()
  currentModels = settings.models.filter(m => m.enabled !== false)
  return startServer(settings)
}

export function isServerRunning(): boolean {
  return server !== null
}

export function getListeningPort(): number {
  const addr = server?.address()
  if (addr && typeof addr === 'object') return addr.port
  return 0
}

export function updateModels(models: ModelEntry[]): void {
  currentModels = models.filter(m => m.enabled !== false)
}
