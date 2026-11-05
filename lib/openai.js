// Thin, explicit client for the OpenAI Images API.
//
// Two rules keep this predictable:
//   1. The request body only ever contains parameters the Images API documents
//      (model/prompt/n/size/quality/background/output_format/...). No diffusion
//      leftovers such as seed, steps, negative_prompt or guidance_scale.
//   2. Errors are surfaced with the provider's own code/type so a caller can
//      tell "bad parameter" from "quota" from "moderation" without guessing.

import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { briefSlug, resolveUserPath, timestamp } from './paths.js'
import { sleep } from './paths.js'

export const ASPECT_TO_SIZE = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
  '4:3': '1536x1024',
  '2:3': '1024x1536',
  '9:16': '1024x1536',
  '3:4': '1024x1536',
}

export const TRANSPARENT_FORMATS = ['png', 'webp']

export function clampCount(value) {
  const count = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 1
  return Math.min(4, Math.max(1, count || 1))
}

export function resolveSize(args = {}, cfg = {}) {
  const ratio = args.aspect_ratio
  if (ratio && ASPECT_TO_SIZE[ratio]) return ASPECT_TO_SIZE[ratio]
  if (args.size) return String(args.size)
  return cfg.size || '1024x1024'
}

export function buildGenerationBody(args = {}, cfg = {}, prompt = '') {
  const body = {
    model: args.model || cfg.model,
    prompt,
    n: clampCount(args.count),
  }
  const size = resolveSize(args, cfg)
  if (size && size !== 'auto') body.size = size
  const quality = args.quality || cfg.quality
  if (quality && quality !== 'auto') body.quality = quality
  const format = args.output_format || cfg.outputFormat
  if (format) body.output_format = format
  if (args.background && args.background !== 'auto') body.background = args.background
  return body
}

export function assertTransparentCombination(format, background) {
  if (background === 'transparent' && !TRANSPARENT_FORMATS.includes(format)) {
    throw new Error(
      `transparent backgrounds require output_format png or webp (got "${format}")`,
    )
  }
}

export function describeApiError(status, payload) {
  const error = payload?.error ?? payload ?? {}
  const message = error.message || payload?.message || `HTTP ${status}`
  const code = error.code || error.type
  return code
    ? `OpenAI image API failed (HTTP ${status}, code=${code}): ${message}`
    : `OpenAI image API failed (HTTP ${status}): ${message}`
}

export function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500
}

export async function resolveCredential(ctx, ref, label) {
  const name = String(ref || '').trim()
  if (!name) throw new Error(`No credential reference configured for ${label}`)
  const credentials = typeof ctx?.get === 'function' ? ctx.get('credentials') : undefined
  try {
    const resolved = await credentials?.resolve?.(name)
    if (resolved?.value) return resolved.value
  } catch {
    // fall through to the environment
  }
  const fromEnv = process.env[name]
  if (fromEnv) return fromEnv
  throw new Error(
    `No ${label} found. Store it as the credential "${name}" in DSH, or set the ${name} environment variable.`,
  )
}

export async function callImagesApi(ctx, cfg, { endpoint, json, form, headers = {} }, log = () => {}) {
  const key = await resolveCredential(ctx, cfg.apiKeyEnv, 'OpenAI API key')
  const url = `${cfg.baseURL}${endpoint}`
  const attempts = Math.max(1, (cfg.retries ?? 2) + 1)
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const init = {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, ...headers },
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 180000),
    }
    if (json) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(json)
    } else {
      init.body = form
    }

    try {
      const response = await fetch(url, init)
      const text = await response.text()
      let payload
      try {
        payload = text ? JSON.parse(text) : {}
      } catch {
        payload = { raw: text.slice(0, 800) }
      }
      if (response.ok) return payload

      if (isRetryableStatus(response.status) && attempt < attempts) {
        log(`dsh-openai-image: HTTP ${response.status}, retrying (${attempt}/${attempts - 1})`)
        await sleep(600 * attempt)
        continue
      }
      throw new Error(describeApiError(response.status, payload))
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error(`OpenAI image API timed out after ${cfg.timeoutMs}ms`)
      }
      lastError = error
      if (attempt >= attempts) throw error
      log(`dsh-openai-image: request failed, retrying (${attempt}/${attempts - 1}): ${error?.message || error}`)
      await sleep(600 * attempt)
    }
  }
  throw lastError
}

export function decodeImageItem(item) {
  if (!item) return undefined
  if (typeof item.b64_json === 'string' && item.b64_json) return Buffer.from(item.b64_json, 'base64')
  return undefined
}

export async function fetchImageItem(item) {
  const inline = decodeImageItem(item)
  if (inline) return inline
  if (typeof item?.url === 'string' && item.url) {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`download failed (HTTP ${response.status}) for ${item.url}`)
    return Buffer.from(await response.arrayBuffer())
  }
  return undefined
}

export async function materialize(payload, options) {
  const { args = {}, cfg, format, cwd, stem, extra = {}, ctx } = options
  const data = Array.isArray(payload?.data) ? payload.data : []
  if (data.length === 0) throw new Error('OpenAI image API returned no image data')

  const outDir = resolveUserPath(args.output_dir || cfg.outputDir, cwd)
  await mkdir(outDir, { recursive: true })

  const baseStem = briefSlug(stem || args.output_name || args.prompt || 'image')
  const stamp = timestamp()
  const extension = format === 'jpeg' ? 'jpg' : format || 'png'

  const saved = []
  for (const [index, item] of data.entries()) {
    const bytes = await fetchImageItem(item)
    if (!bytes) continue
    const suffix = data.length > 1 ? `-${index + 1}` : ''
    const absolute = path.join(outDir, `${baseStem}-${stamp}${suffix}.${extension}`)
    await writeFile(absolute, bytes)
    const sidecar = {
      generated_at: new Date().toISOString(),
      model: extra.model,
      prompt: extra.prompt,
      preset: extra.preset || '',
      size: extra.size,
      quality: extra.quality,
      format: extension,
      revised_prompt: item.revised_prompt || '',
      bytes: bytes.length,
      ...(extra.roblox ? { roblox: extra.roblox } : {}),
    }
    await writeFile(`${absolute}.json`, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8')
    saved.push({ path: absolute, bytes: bytes.length, format: extension, revisedPrompt: item.revised_prompt || '' })
  }
  if (saved.length === 0) throw new Error('OpenAI image API returned an empty image payload')
  if (typeof ctx?.logger?.info === 'function') {
    ctx.logger.info(`dsh-openai-image: saved ${saved.length} image(s) to ${outDir}`)
  }
  return saved
}
