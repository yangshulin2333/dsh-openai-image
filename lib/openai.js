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
import { briefSlug, mimeOf, resolveUserPath, timestamp } from './paths.js'
import { sleep } from './paths.js'
import { GIF_FRAME_LIMITS, GIF_SIZES } from './config.js'

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
  return Math.min(10, Math.max(1, count || 1))
}

// The API takes any WIDTHxHEIGHT as long as both sides are multiples of 16 and
// the longest edge stays at or below 3840. Validate here so the caller gets a
// sentence instead of "Invalid size".
export function validateSize(value) {
  const size = String(value || '').trim()
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(size)
  if (!match) throw new Error(`size must look like 1024x1024 (got "${size}")`)
  const width = Number(match[1])
  const height = Number(match[2])
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new Error(`size ${size}: width and height must both be divisible by 16 (try 1024x1024 or 1824x1024)`)
  }
  if (Math.max(width, height) > 3840) {
    throw new Error(`size ${size}: the longest edge must be at most 3840 (try 1824x1024 or 2048x2048)`)
  }
  return size
}

export function resolveSize(args = {}, cfg = {}) {
  const ratio = args.aspect_ratio
  if (ratio && ASPECT_TO_SIZE[ratio]) return ASPECT_TO_SIZE[ratio]
  if (args.size && args.size !== 'auto') return validateSize(args.size)
  if (cfg.size && cfg.size !== 'auto') return validateSize(cfg.size)
  return 'auto'
}

export function clampFrameCount(value, fallback = GIF_FRAME_LIMITS.fallback) {
  const frames = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback
  return Math.min(GIF_FRAME_LIMITS.max, Math.max(GIF_FRAME_LIMITS.min, frames || fallback))
}

// A GIF request is served from a sprite sheet the API slices, so the sheet must
// fit the pixel budget. Anything above 512x512 blows it, thus small sizes only.
export function resolveGifSize(args = {}, cfg = {}) {
  const wanted = args.size ? String(args.size) : ''
  if (GIF_SIZES.includes(wanted)) return wanted
  if (GIF_SIZES.includes(String(cfg.size || ''))) return String(cfg.size)
  return GIF_SIZES[GIF_SIZES.length - 1]
}

// Parameters both endpoints understand. Kept in one place so the two tools
// cannot drift apart again.
export function applySharedOptions(body, args = {}, cfg = {}, format = '') {
  const moderation = args.moderation || cfg.moderation
  if (moderation && moderation !== 'auto') body.moderation = moderation
  if (format === 'jpeg' || format === 'webp') {
    const compression = Number(args.output_compression ?? cfg.outputCompression)
    if (Number.isFinite(compression) && compression > 0) {
      body.output_compression = Math.min(100, Math.max(0, Math.trunc(compression)))
    }
  }
  if (args.user) body.user = String(args.user)
  if (args.safety_identifier) body.safety_identifier = String(args.safety_identifier)
  const partials = clampPartialImages(args.partial_images)
  if (partials > 0) {
    // Streaming is the only way the API hands out partial previews.
    body.stream = true
    body.partial_images = partials
  }
  return body
}

export function clampPartialImages(value) {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) ? Math.min(3, Math.max(0, n)) : 0
}

export const INPUT_FIDELITIES = ['low', 'high']

export function buildGenerationBody(args = {}, cfg = {}, prompt = '') {
  const format = args.output_format || cfg.outputFormat
  const body = {
    model: args.model || cfg.model,
    prompt,
    n: clampCount(args.count),
  }

  if (format === 'svg') {
    // Vector output is drawn by a text model, not the image model: the Images
    // API requires svg.model and rejects size/quality variants it cannot use.
    body.output_format = 'svg'
    body.svg = { model: args.svg_model || cfg.svgModel }
    return applySharedOptions(body, args, cfg, format)
  }

  if (format === 'gif') {
    body.size = resolveGifSize(args, cfg)
    body.output_format = 'gif'
    body.frame_count = clampFrameCount(args.frame_count ?? cfg.frameCount)
    const gifQuality = args.quality || cfg.quality
    if (gifQuality && gifQuality !== 'auto') body.quality = gifQuality
    return applySharedOptions(body, args, cfg, format)
  }

  const size = resolveSize(args, cfg)
  if (size && size !== 'auto') body.size = size
  const quality = args.quality || cfg.quality
  if (quality && quality !== 'auto') body.quality = quality
  if (format) body.output_format = format
  if (args.background && args.background !== 'auto') body.background = args.background
  return applySharedOptions(body, args, cfg, format)
}

// /v1/images/edits has its own rules: several inputs go through the `image[]`
// array syntax (repeating `image` is rejected as a duplicate parameter), and the
// mask must be a PNG that actually carries an alpha channel.
export function buildEditForm({ args = {}, cfg = {}, prompt = '', sources = [], mask, format }) {
  const form = new FormData()
  form.append('model', args.model || cfg.model)
  form.append('prompt', prompt)
  form.append('n', String(clampCount(args.count)))

  if (format === 'gif') {
    form.append('size', resolveGifSize(args, cfg))
    form.append('frame_count', String(clampFrameCount(args.frame_count ?? cfg.frameCount)))
  } else {
    const size = resolveSize(args, cfg)
    if (size && size !== 'auto') form.append('size', size)
  }

  const quality = args.quality || cfg.quality
  if (quality && quality !== 'auto') form.append('quality', quality)
  if (format) form.append('output_format', format)
  if (args.background && args.background !== 'auto') form.append('background', args.background)
  if (INPUT_FIDELITIES.includes(args.input_fidelity)) form.append('input_fidelity', args.input_fidelity)

  const shared = applySharedOptions({}, args, cfg, format)
  for (const [key, value] of Object.entries(shared)) form.append(key, String(value))

  const field = sources.length > 1 ? 'image[]' : 'image'
  for (const source of sources) {
    form.append(field, new Blob([source.bytes], { type: mimeOf(source.name) }), source.name)
  }
  if (mask) form.append('mask', new Blob([mask.bytes], { type: 'image/png' }), 'mask.png')
  return form
}

// The API always writes GIF delays of 20cs (5 fps). Rewrite the Graphic Control
// Extension delays so a short loop actually plays at a usable speed.
//
// Walks the GIF block structure instead of byte-scanning: LZW image data can
// contain 0x21 0xF9 0x04 by chance, and patching that would corrupt a frame.
// Any structural surprise returns the original bytes untouched.
export function retimeGif(bytes, fps) {
  const rate = Number(fps)
  if (!Buffer.isBuffer(bytes) || !Number.isFinite(rate) || rate <= 0 || rate > 50) return bytes
  if (bytes.length < 13 || bytes.subarray(0, 3).toString('latin1') !== 'GIF') return bytes
  const delay = Math.max(1, Math.round(100 / rate))
  const copy = Buffer.from(bytes)
  const skipSubBlocks = (at) => {
    let i = at
    while (i < copy.length) {
      const size = copy[i]
      i += 1
      if (size === 0) return i
      i += size
    }
    return -1
  }
  let i = 13
  const flags = copy[10]
  if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1)) // global color table
  let patched = 0
  while (i < copy.length) {
    const marker = copy[i]
    if (marker === 0x3b) break // trailer
    if (marker === 0x21) {
      const label = copy[i + 1]
      if (label === 0xf9 && copy[i + 2] === 0x04 && i + 6 < copy.length) {
        copy.writeUInt16LE(delay, i + 4)
        patched += 1
      }
      i = skipSubBlocks(i + 2)
    } else if (marker === 0x2c) {
      if (i + 10 > copy.length) return bytes
      const local = copy[i + 9]
      i += 10
      if (local & 0x80) i += 3 * (1 << ((local & 0x07) + 1)) // local color table
      i = skipSubBlocks(i + 1) // LZW min code size, then data
    } else {
      return bytes
    }
    if (i < 0) return bytes
  }
  return patched > 0 ? copy : bytes
}

export function assertTransparentCombination(format, background) {
  if (background === 'transparent' && !TRANSPARENT_FORMATS.includes(format)) {
    throw new Error(
      `transparent backgrounds require output_format png or webp (got "${format}")`,
    )
  }
}

// The edits endpoint rejects a mask without an alpha channel, so catch it before
// the upload: "Invalid mask image format - mask image missing alpha channel".
export function assertMaskHasAlpha(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || [])
  const isPng = buffer.length > 26 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!isPng) throw new Error('mask must be a PNG file (the API only accepts PNG masks)')
  const colorType = buffer[25]
  if (colorType !== 4 && colorType !== 6) {
    throw new Error(
      'mask PNG has no alpha channel: export it as RGBA (color type 6) with transparent pixels marking the area to repaint',
    )
  }
  return buffer
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

    let response
    let text
    try {
      response = await fetch(url, init)
      text = await response.text()
    } catch (error) {
      // Only transport failures land here. A timeout is not retried: the image
      // may still be rendering (and billing) on the server side.
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error(`OpenAI image API timed out after ${cfg.timeoutMs}ms`)
      }
      lastError = new Error(`OpenAI image API network error: ${error?.message || error}`)
      if (attempt >= attempts) throw lastError
      log(`dsh-openai-image: request failed, retrying (${attempt}/${attempts - 1}): ${error?.message || error}`)
      await sleep(backoffMs(attempt))
      continue
    }

    const isStream = /text\/event-stream/i.test(response.headers?.get?.('content-type') || '') || /^\s*(event|data):/.test(text)
    if (response.ok && isStream) return parseImageStream(text)

    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { raw: text.slice(0, 800) }
    }
    if (response.ok) return payload

    // 400 (bad parameter, moderation block), 401, 403, 404 are final: retrying
    // them only adds seconds before the same answer.
    lastError = new Error(describeApiError(response.status, payload))
    if (!isRetryableStatus(response.status) || attempt >= attempts) throw lastError
    log(`dsh-openai-image: HTTP ${response.status}, retrying (${attempt}/${attempts - 1})`)
    await sleep(backoffMs(attempt, response.headers?.get?.('retry-after')))
  }
  throw lastError
}

// A streamed Images response (stream=true) is a series of SSE events:
//   image_generation.partial_image / image_edit.partial_image  → preview frames
//   image_generation.completed     / image_edit.completed      → the final image
// Fold it back into the non-stream shape ({ data: [...] }) plus `partials`,
// so everything downstream stays the same.
export function parseImageStream(text) {
  const data = []
  const partials = []
  let usage
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/)
    const eventLine = lines.find((line) => line.startsWith('event:'))
    const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart())
    if (dataLines.length === 0) continue
    const raw = dataLines.join('\n')
    if (raw === '[DONE]') continue
    let event
    try {
      event = JSON.parse(raw)
    } catch {
      continue
    }
    const type = String(event.type || eventLine?.slice(6).trim() || '')
    if (type === 'error' || event.error) {
      throw new Error(describeApiError(200, event))
    }
    if (type.endsWith('.partial_image')) {
      partials.push({ b64_json: event.b64_json, index: event.partial_image_index ?? partials.length })
    } else if (type.endsWith('.completed')) {
      data.push({ b64_json: event.b64_json, revised_prompt: event.revised_prompt })
      if (event.usage) usage = event.usage
    }
  }
  if (data.length === 0) throw new Error('OpenAI image stream ended without a completed image')
  return { data, partials, ...(usage ? { usage } : {}) }
}

// Exponential backoff, honouring Retry-After (seconds) when the server sends
// one, capped so a misbehaving proxy cannot park a tool call for minutes.
export function backoffMs(attempt, retryAfter) {
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(30000, seconds * 1000)
  return Math.min(10000, 800 * 2 ** (attempt - 1))
}

// Two calls with the same prompt inside one second share a stem and stamp, so
// write exclusively and step a counter instead of silently overwriting.
export async function writeUnique(dir, stem, extension, bytes) {
  for (let n = 0; n < 1000; n += 1) {
    const absolute = path.join(dir, `${stem}${n === 0 ? '' : `_${n + 1}`}.${extension}`)
    try {
      await writeFile(absolute, bytes, { flag: 'wx' })
      return absolute
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new Error(`could not find a free file name for ${stem}.${extension} in ${dir}`)
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
    let bytes = await fetchImageItem(item)
    if (!bytes) continue
    if (typeof options.postProcess === 'function') bytes = options.postProcess(bytes)
    const suffix = data.length > 1 ? `-${index + 1}` : ''
    const absolute = await writeUnique(outDir, `${baseStem}-${stamp}${suffix}`, extension, bytes)
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
      ...(Array.isArray(extra.source_images) ? { source_images: extra.source_images } : {}),
      ...(payload.usage ? { usage: payload.usage } : {}),
      ...(extra.roblox ? { roblox: extra.roblox } : {}),
    }
    await writeFile(`${absolute}.json`, `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8')
    saved.push({ path: absolute, bytes: bytes.length, format: extension, revisedPrompt: item.revised_prompt || '' })
  }
  if (saved.length === 0) throw new Error('OpenAI image API returned an empty image payload')

  // Streamed calls also deliver low-detail previews; keep them next to the
  // final image so the progression is inspectable.
  const partials = Array.isArray(payload.partials) ? payload.partials : []
  if (partials.length > 0) {
    saved[0].partials = []
    for (const partial of partials) {
      const bytes = decodeImageItem(partial)
      if (!bytes) continue
      const absolute = await writeUnique(outDir, `${baseStem}-${stamp}-partial-${Number(partial.index) + 1}`, extension, bytes)
      saved[0].partials.push(absolute)
    }
  }
  if (typeof ctx?.logger?.info === 'function') {
    ctx.logger.info(`dsh-openai-image: saved ${saved.length} image(s) to ${outDir}`)
  }
  return saved
}
