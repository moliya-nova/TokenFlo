import type { IncomingMessage, ServerResponse } from 'http'
import type { ModelEntry } from '../../src/shared/relay-types'
import { recordUsage } from './stats'

// ============================================================
// 请求代理 — 纯透明中转
// ============================================================

export async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  models: ModelEntry[]
): Promise<void> {
  const url = req.url || '/'
  const pathname = url.split('?')[0]
  console.log(`[Proxy] Received ${req.method} ${url}`)
  
  const body = await readBody(req)
  let parsedBody: any
  try {
    parsedBody = JSON.parse(body)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Invalid JSON body' } }))
    return
  }

  const modelId = parsedBody.model
  console.log(`[Proxy] Request model: "${modelId}"`)
  console.log(`[Proxy] Available models: ${models.filter(m => m.enabled !== false).map(m => `"${m.id}"`).join(', ')}`)
  
  if (!modelId) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Missing "model" field in request' } }))
    return
  }

  const modelConfig = models.find(m => m.id === modelId && m.enabled !== false)
  if (!modelConfig) {
    console.log(`[Proxy] ERROR: Model "${modelId}" not found in configuration`)
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: {
        message: `Unknown model "${modelId}". Available models: ${models.filter(m => m.enabled !== false).map(m => m.id).join(', ')}`,
        type: 'unknown_model'
      }
    }))
    return
  }

  console.log(`[Proxy] Found model config: "${modelConfig.name || modelConfig.id}" -> ${modelConfig.apiBase}`)

  const isStream = parsedBody.stream === true

  try {
    await proxyTransparent(modelConfig, modelId, body, req, res, isStream, pathname)
  } catch (e: any) {
    console.error(`[Proxy] Error:`, e)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `Proxy error: ${e.message}` } }))
    }
  }
}

// ============================================================
// 纯透明转发
// ============================================================

function buildTargetUrl(apiBase: string, requestPath: string): string {
  const standardEndings = ['/v1/chat/completions', '/v1/messages', '/chat/completions', '/messages']
  const endsWithStandard = standardEndings.some(ending => apiBase.endsWith(ending))
  if (endsWithStandard) {
    return apiBase
  }
  const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase
  return `${base}${requestPath}`
}

async function proxyTransparent(
  modelConfig: ModelEntry,
  modelId: string,
  body: string,
  req: IncomingMessage,
  res: ServerResponse,
  isStream: boolean,
  requestUrl: string
): Promise<void> {
  const targetUrl = buildTargetUrl(modelConfig.apiBase, requestUrl)
  console.log(`[Proxy] Forwarding to: ${targetUrl}`)

  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host' && value) {
      forwardHeaders[key] = Array.isArray(value) ? value.join(', ') : value
    }
  }

  if (!forwardHeaders['authorization'] && !forwardHeaders['x-api-key'] && modelConfig.apiKey) {
    forwardHeaders['authorization'] = `Bearer ${modelConfig.apiKey}`
  }

  console.log(`[Proxy] Forward headers:`, Object.keys(forwardHeaders))

  const resp = await fetch(targetUrl, {
    method: 'POST',
    headers: forwardHeaders,
    body: body
  })

  console.log(`[Proxy] Response status: ${resp.status} ${resp.statusText}`)

  if (!resp.ok) {
    const errText = await resp.text()
    console.error(`[Proxy] Error response:`, errText)
    res.writeHead(resp.status, { 'Content-Type': 'application/json' })
    res.end(errText)
    return
  }

  if (isStream) {
    await handleStreamResponse(resp, res, modelId)
  } else {
    await handleNonStreamResponse(resp, res, modelId)
  }
}

// ============================================================
// 非流式响应处理
// ============================================================

async function handleNonStreamResponse(
  resp: globalThis.Response,
  res: ServerResponse,
  modelId: string
): Promise<void> {
  const data = await resp.json()
  console.log(`[Proxy] Non-stream response keys:`, Object.keys(data))

  const usage = data.usage
  if (usage) {
    const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
    const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
    console.log(`[Proxy] Found usage: ${promptTokens} prompt, ${completionTokens} completion`)
    if (promptTokens > 0 || completionTokens > 0) {
      recordUsage(modelId, promptTokens, completionTokens)
    }
  } else {
    console.log(`[Proxy] No usage field in non-stream response`)
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  })
  res.end(JSON.stringify(data))
}

// ============================================================
// 流式响应处理
// ============================================================

async function handleStreamResponse(
  resp: globalThis.Response,
  res: ServerResponse,
  modelId: string
): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })

  const reader = resp.body?.getReader()
  if (!reader) {
    res.end()
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let foundUsage = false
  let promptTokens = 0
  let completionTokens = 0
  let chunkCount = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      res.write(text)
      chunkCount++

      if (!foundUsage) {
        buffer += text

        // OpenAI 格式 - 取最后一个非零的 usage
        const openaiMatches = buffer.matchAll(/"usage"\s*:\s*\{[^}]+\}/g)
        for (const match of openaiMatches) {
          try {
            const usageStr = match[0].replace(/^"usage"\s*:\s*/, '')
            const usage = JSON.parse(usageStr)
            const p = usage.prompt_tokens || 0
            const c = usage.completion_tokens || 0
            if (p > 0 || c > 0) {
              promptTokens = p
              completionTokens = c
              foundUsage = true
            }
          } catch { }
        }
        if (foundUsage) {
          console.log(`[Proxy] Found OpenAI usage: ${promptTokens} / ${completionTokens}`)
        }

        // Anthropic 格式 - 取最后一个非零的 usage
        if (!foundUsage) {
          const inputMatches = [...buffer.matchAll(/"input_tokens"\s*:\s*(\d+)/g)]
          const outputMatches = [...buffer.matchAll(/"output_tokens"\s*:\s*(\d+)/g)]
          
          if (inputMatches.length > 0 && outputMatches.length > 0) {
            // 取最后一个匹配
            const lastInput = parseInt(inputMatches[inputMatches.length - 1][1], 10)
            const lastOutput = parseInt(outputMatches[outputMatches.length - 1][1], 10)
            
            if (lastInput > 0 || lastOutput > 0) {
              promptTokens = lastInput
              completionTokens = lastOutput
              foundUsage = true
              console.log(`[Proxy] Found Anthropic usage: ${promptTokens} / ${completionTokens}`)
            }
          }
        }
      }
    }
  } finally {
    console.log(`[Proxy] Stream finished, ${chunkCount} chunks, buffer length: ${buffer.length}`)
    
    // 始终打印 buffer 内容帮助调试
    if (buffer.length > 0) {
      console.log(`[Proxy] Full buffer content:`)
      console.log(buffer)
    }
    
    if (foundUsage) {
      console.log(`[Proxy] Recording usage: ${promptTokens} prompt, ${completionTokens} completion`)
      recordUsage(modelId, promptTokens, completionTokens)
    } else {
      // 打印缓冲区内容帮助调试
      console.log(`[Proxy] No usage found, buffer preview (first 1000 chars):`)
      console.log(buffer.slice(0, 1000))
      
      // 尝试从内容估算
      const contentMatches = buffer.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*?)"/g)
      let totalChars = 0
      if (contentMatches) {
        for (const m of contentMatches) {
          const content = m.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*?)"/)
          if (content) totalChars += content[1].length
        }
      }
      if (totalChars > 0) {
        const estimatedTokens = Math.ceil(totalChars / 4)
        console.log(`[Proxy] Estimating ${estimatedTokens} tokens from ${totalChars} chars`)
        recordUsage(modelId, 0, estimatedTokens)
      }
    }
    res.end()
  }
}

// ============================================================
// 辅助函数
// ============================================================

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
