// lib/routes.js — same-origin HTTP endpoints behind the settings page.
//
// Agent-built assets never call these; the browser page does. Every endpoint is
// guarded by the connection service, so a plain curl without the GUI cookie is
// rejected the same way the other plugin routes are.

const ENTRY_ID = 'dsh-openai-image'
const PACKAGE_NAME = '@yangshulin2333/dsh-openai-image'
const KEY_REFS = new Set(['OPENAI_API_KEY', 'ROBLOX_API_KEY'])

function headerOf(req, name) {
  const headers = req?.headers || {}
  const value = headers[name]
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : undefined
}

function rejectStatus(ctx, req) {
  const connection = ctx.get('connection')
  if (connection && typeof connection.requestRejection === 'function') {
    try {
      const rejection = connection.requestRejection(req)
      if (rejection === undefined) return undefined
      if (typeof rejection === 'number' && rejection >= 400 && rejection < 600) return rejection
      return rejection === 401 ? 401 : 403
    } catch {
      return 403
    }
  }
  const site = headerOf(req, 'sec-fetch-site')
  if (site === 'cross-site') return 403
  return undefined
}

function sameOrigin(req) {
  const origin = headerOf(req, 'origin')
  if (!origin) return true
  const host = headerOf(req, 'host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function findEntry(configEditor) {
  const rows = configEditor.configuration()
  for (const row of rows) {
    const entry = row.entry || {}
    if (entry.id === ENTRY_ID || entry.name === PACKAGE_NAME || entry.package === PACKAGE_NAME) return row
  }
  return undefined
}

function pickConfig(rawConfig = {}) {
  return {
    enabled: rawConfig.enabled !== false,
    model: rawConfig.model,
    size: rawConfig.size,
    quality: rawConfig.quality,
    outputFormat: rawConfig.outputFormat,
    background: rawConfig.background,
    outputDir: rawConfig.outputDir,
    apiKeyEnv: rawConfig.apiKeyEnv,
    robloxEnabled: rawConfig.robloxEnabled === true,
    robloxApiKeyEnv: rawConfig.robloxApiKeyEnv,
    robloxCreatorType: rawConfig.robloxCreatorType,
    robloxCreatorId: rawConfig.robloxCreatorId,
    robloxAssetType: rawConfig.robloxAssetType,
  }
}

async function keyState(ctx, ref) {
  try {
    const resolved = await ctx.get('credentials').resolve(ref)
    if (!resolved) return { ref, present: false, source: '' }
    return { ref, present: true, source: resolved.source || '' }
  } catch {
    return { ref, present: false, source: '' }
  }
}

async function testOpenAI(ctx, cfg) {
  const credentials = ctx.get('credentials')
  const resolved = await credentials.resolve(cfg.apiKeyEnv || 'OPENAI_API_KEY')
  if (!resolved?.value) return { ok: false, detail: 'OpenAI API key is not set' }
  const base = String(cfg.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  let response
  try {
    response = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${resolved.value}` },
      signal: AbortSignal.timeout(30000),
    })
  } catch (error) {
    return { ok: false, detail: `network error: ${error.message}` }
  }
  if (response.ok) return { ok: true, detail: 'key accepted by /v1/models' }
  const text = (await response.text().catch(() => '')).slice(0, 300)
  return { ok: false, detail: `HTTP ${response.status}: ${text || 'no body'}` }
}

async function testRoblox(ctx, cfg) {
  const credentials = ctx.get('credentials')
  const resolved = await credentials.resolve(cfg.robloxApiKeyEnv || 'ROBLOX_API_KEY')
  if (!resolved?.value) return { ok: false, detail: 'Roblox API key is not set' }
  let response
  try {
    response = await fetch('https://apis.roblox.com/assets/v1/assets', {
      method: 'POST',
      headers: { 'x-api-key': resolved.value, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30000),
    })
  } catch (error) {
    return { ok: false, detail: `network error: ${error.message}` }
  }
  // An authenticated request rejects our empty body with 400 before it ever
  // looks at permissions, which is exactly the signal we want.
  if (response.status === 400) return { ok: true, detail: 'key accepted (empty body rejected as expected)' }
  if (response.status === 401) return { ok: false, detail: 'key rejected (401 Invalid API Key)' }
  const text = (await response.text().catch(() => '')).slice(0, 300)
  return { ok: false, detail: `HTTP ${response.status}: ${text || 'no body'}` }
}

export function registerSettingsRoutes(ctx, { cfg }) {
  const webServer = ctx.get('webServer')
  if (!webServer || typeof webServer.register !== 'function') return

  const guard = (req, res, { write = false } = {}) => {
    const status = rejectStatus(ctx, req)
    if (status !== undefined) {
      send(res, status, { ok: false, error: status === 401 ? 'unauthorized' : 'forbidden' })
      return false
    }
    if (write && !sameOrigin(req)) {
      send(res, 403, { ok: false, error: 'cross-origin write rejected' })
      return false
    }
    return true
  }

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/dsh-openai-image/state',
        handler: async (req, res) => {
          if (!guard(req, res)) return
          if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'GET only' })
          const configEditor = ctx.get('configEditor')
          const row = configEditor ? findEntry(configEditor) : undefined
          send(res, 200, {
            ok: true,
            entry: row ? { id: row.entry.id, name: row.entry.name } : null,
            config: pickConfig({ ...cfg, ...((row && (row.override || row.inherited)) || {}) }),
            keys: [
              await keyState(ctx, cfg.apiKeyEnv || 'OPENAI_API_KEY'),
              await keyState(ctx, cfg.robloxApiKeyEnv || 'ROBLOX_API_KEY'),
            ],
            activeConfig: pickConfig(cfg),
          })
        },
      }),
    'dsh-openai-image: state route',
  )

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/dsh-openai-image/config',
        handler: async (req, res) => {
          if (!guard(req, res, { write: req.method !== 'GET' })) return
          if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' })
          const configEditor = ctx.get('configEditor')
          if (!configEditor) return send(res, 503, { ok: false, error: 'config editor unavailable' })
          const patch = await readJson(req)
          const cleaned = {}
          for (const key of Object.keys(pickConfig(patch))) {
            if (patch[key] !== undefined) cleaned[key] = patch[key]
          }
          try {
            const row = findEntry(configEditor)
            if (!row) return send(res, 409, { ok: false, error: `config entry "${ENTRY_ID}" not found` })
            await configEditor.edit(row.entry, (current) => ({ ...current, ...cleaned }))
          } catch (error) {
            return send(res, 500, { ok: false, error: error.message })
          }
          send(res, 200, { ok: true, applied: Object.keys(cleaned) })
        },
      }),
    'dsh-openai-image: config route',
  )

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/dsh-openai-image/key',
        handler: async (req, res) => {
          if (!guard(req, res, { write: true })) return
          if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' })
          const credentials = ctx.get('credentials')
          if (!credentials) return send(res, 503, { ok: false, error: 'credentials service unavailable' })
          const body = await readJson(req)
          const ref = String(body.ref || '')
          const value = String(body.value || '').trim()
          if (!KEY_REFS.has(ref)) return send(res, 400, { ok: false, error: `ref must be one of ${[...KEY_REFS].join(', ')}` })
          if (value.length < 20) return send(res, 400, { ok: false, error: 'value looks truncated (min 20 chars)' })
          try {
            await credentials.set(ref, value)
          } catch (error) {
            return send(res, 500, { ok: false, error: error.message })
          }
          send(res, 200, { ok: true, ref, stored: true })
        },
      }),
    'dsh-openai-image: key route',
  )

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/dsh-openai-image/test',
        handler: async (req, res) => {
          if (!guard(req, res, { write: true })) return
          if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' })
          const body = await readJson(req)
          const target = String(body.target || '')
          try {
            if (target === 'openai') return send(res, 200, { ok: true, result: await testOpenAI(ctx, cfg) })
            if (target === 'roblox') return send(res, 200, { ok: true, result: await testRoblox(ctx, cfg) })
          } catch (error) {
            return send(res, 500, { ok: false, error: error.message })
          }
          send(res, 400, { ok: false, error: 'target must be "openai" or "roblox"' })
        },
      }),
    'dsh-openai-image: test route',
  )
}
