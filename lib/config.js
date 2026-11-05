// Configuration surface for dsh-openai-image.
//
// The schema is optional: when @deepseek-ai/schemastery is not resolvable
// (for example in a bare unit-test run) the plugin still works, it just has
// no settings form. In a real DSH profile the schema is what renders the
// "插件配置" panel, so keep every field documented.

// The API accepts any WIDTHxHEIGHT whose sides are divisible by 16 and whose
// longest edge is at most 3840, so these are suggestions rather than a limit.
export const SIZES = ['auto', '512x512', '1024x1024', '1536x1024', '1024x1536', '1824x1024', '1024x1824']
export const QUALITIES = ['auto', 'low', 'medium', 'high']
// 'low' relaxes the safety filter; 'auto' is the API default.
export const MODERATIONS = ['auto', 'low']
// png/jpeg/webp are raster stills; gif is a short looping animation; svg is a
// vector drawing produced by a text model (see SVG_MODEL_SUGGESTIONS).
export const FORMATS = ['png', 'jpeg', 'webp', 'gif', 'svg']
export const BACKGROUNDS = ['auto', 'opaque', 'transparent']
// The Images API turns a GIF request into a sprite sheet and slices it, so the
// sheet must stay inside the pixel budget: only small sizes survive.
export const GIF_SIZES = ['256x256', '512x512']
export const GIF_FRAME_LIMITS = { min: 2, max: 16, fallback: 6 }
export const SVG_MODEL_SUGGESTIONS = ['gpt-6.1-sol', 'gpt-6-astra']
// Only these two exist for 2.6: 'gpt-image-2.6' and 'gpt-image-2.6-medium' are
// rejected with "model does not exist".
export const MODEL_SUGGESTIONS = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']

export const DEFAULTS = {
  enabled: true,
  apiKeyEnv: 'OPENAI_API_KEY',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-image-2.6-flare',
  size: '1024x1024',
  quality: 'auto',
  outputFormat: 'png',
  frameCount: GIF_FRAME_LIMITS.fallback,
  gifFps: 0,
  svgModel: SVG_MODEL_SUGGESTIONS[0],
  moderation: 'auto',
  outputCompression: 0,
  outputDir: 'generated-images',
  timeoutMs: 180000,
  retries: 2,
  promptSuffix: '',
  defaultPreset: '',
  robloxEnabled: false,
  robloxApiKeyEnv: 'ROBLOX_API_KEY',
  robloxCreatorType: 'user',
  robloxCreatorId: '',
  robloxAssetType: 'Decal',
}

let z
try {
  const mod = await import('@deepseek-ai/schemastery')
  z = mod?.default ?? mod
  if (typeof z?.object !== 'function') z = undefined
} catch {
  z = undefined
}

// The settings service only serves a form for fields whose nearest ancestor is
// marked volatile (see volatileForm in @deepseek-ai/dsh-settings); a schema
// without one is invisible to `settings.describe`. Newer schemastery builds
// expose `.volatile()`, older ones only carry `meta`, so cover both.
function markVolatile(schema) {
  if (!schema) return schema
  if (typeof schema.volatile === 'function') {
    try {
      return schema.volatile()
    } catch {
      // fall through to the meta form
    }
  }
  if (schema.meta && typeof schema.meta === 'object') schema.meta.volatile = true
  return schema
}

export const Config = z
  ? markVolatile(
      z.object({
      enabled: z
        .boolean()
        .description('Master switch. When false, every tool refuses to run.')
        .default(DEFAULTS.enabled),
      apiKeyEnv: z
        .string()
        .role('credential-ref')
        .description('DSH credential / environment variable that stores the OpenAI API key.')
        .default(DEFAULTS.apiKeyEnv),
      baseURL: z
        .string()
        .description('OpenAI-compatible base URL. Keep the default unless you use a proxy.')
        .default(DEFAULTS.baseURL),
      model: z
        .string()
        .description(`Default image model. Recommended: ${MODEL_SUGGESTIONS.slice(0, 3).join(', ')}.`)
        .default(DEFAULTS.model),
      size: z
        .string()
        .description(`Default size when the call omits size/aspect_ratio. One of: ${SIZES.join(', ')}.`)
        .default(DEFAULTS.size),
      quality: z
        .string()
        .description(`Default quality. One of: ${QUALITIES.join(', ')}. "auto" lets the model decide.`)
        .default(DEFAULTS.quality),
      outputFormat: z
        .string()
        .description(`Default output format. One of: ${FORMATS.join(', ')}. gif loops, svg is vector.`)
        .default(DEFAULTS.outputFormat),
      frameCount: z
        .number()
        .description(`GIF frame count (${GIF_FRAME_LIMITS.min}-${GIF_FRAME_LIMITS.max}). The API sheet-slices, so more frames means a smaller size.`)
        .default(DEFAULTS.frameCount),
      gifFps: z
        .number()
        .description('Retime finished GIFs to this frame rate (1-50). 0 keeps the API timing, which is a slow 5 fps.')
        .default(DEFAULTS.gifFps),
      svgModel: z
        .string()
        .description(`Text model that writes the SVG when output_format is svg. Recommended: ${SVG_MODEL_SUGGESTIONS.join(', ')}.`)
        .default(DEFAULTS.svgModel),
      moderation: z
        .union([z.const('auto'), z.const('low')])
        .description('Safety filter strength: "auto" is the default, "low" relaxes it.')
        .default(DEFAULTS.moderation),
      outputCompression: z
        .number()
        .description('Compression 0-100 for jpeg/webp output. 0 leaves it to the API.')
        .default(DEFAULTS.outputCompression),
      outputDir: z
        .string()
        .description('Default directory (relative to the session working directory) for saved images.')
        .default(DEFAULTS.outputDir),
      timeoutMs: z
        .number()
        .description('Per-request timeout in milliseconds.')
        .default(DEFAULTS.timeoutMs),
      retries: z
        .number()
        .description('Extra attempts for HTTP 408/429/5xx and network failures.')
        .default(DEFAULTS.retries),
      promptSuffix: z
        .string()
        .description('Text appended to every prompt (project-wide style words, negative hints).')
        .default(DEFAULTS.promptSuffix),
      defaultPreset: z
        .string()
        .description('Roblox preset applied when a call names none (game_icon, thumbnail, decal, ui_9slice, seamless_texture, ...).')
        .default(DEFAULTS.defaultPreset),
      robloxEnabled: z
        .boolean()
        .description('Enable the roblox_upload tool. Uploads create real assets on the Roblox account, so it is off by default.')
        .default(DEFAULTS.robloxEnabled),
      robloxApiKeyEnv: z
        .string()
        .role('credential-ref')
        .description('Credential holding a Roblox Open Cloud API key with the assets scope (read + write).')
        .default(DEFAULTS.robloxApiKeyEnv),
      robloxCreatorType: z
        .union([z.const('user'), z.const('group')])
        .description('Upload as a personal user asset ("user") or as a group asset ("group").')
        .default(DEFAULTS.robloxCreatorType),
      robloxCreatorId: z
        .string()
        .description('Roblox user id or group id that owns the uploaded assets.')
        .default(DEFAULTS.robloxCreatorId),
      robloxAssetType: z
        .union([z.const('Decal'), z.const('Image')])
        .description('Asset type used for uploads. "Decal" is what Studio shows in the Toolbox.')
        .default(DEFAULTS.robloxAssetType),
      }),
    )
  : undefined

export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const cfg = { ...DEFAULTS }
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) cfg[key] = value
  }
  cfg.baseURL = String(cfg.baseURL || DEFAULTS.baseURL).replace(/\/+$/, '')
  cfg.model = String(cfg.model || DEFAULTS.model)
  cfg.apiKeyEnv = String(cfg.apiKeyEnv || DEFAULTS.apiKeyEnv)
  cfg.robloxApiKeyEnv = String(cfg.robloxApiKeyEnv || DEFAULTS.robloxApiKeyEnv)
  cfg.robloxCreatorId = String(cfg.robloxCreatorId ?? '')
  cfg.outputDir = String(cfg.outputDir || DEFAULTS.outputDir)
  cfg.timeoutMs = Number(cfg.timeoutMs) > 0 ? Number(cfg.timeoutMs) : DEFAULTS.timeoutMs
  cfg.retries = Number.isInteger(cfg.retries) && cfg.retries >= 0 ? cfg.retries : DEFAULTS.retries
  cfg.enabled = cfg.enabled !== false
  cfg.robloxEnabled = cfg.robloxEnabled === true
  cfg.promptSuffix = typeof cfg.promptSuffix === 'string' ? cfg.promptSuffix.trim() : ''
  cfg.defaultPreset = typeof cfg.defaultPreset === 'string' ? cfg.defaultPreset.trim() : ''
  const frames = Number(cfg.frameCount)
  cfg.frameCount = Number.isFinite(frames)
    ? Math.min(GIF_FRAME_LIMITS.max, Math.max(GIF_FRAME_LIMITS.min, Math.trunc(frames)))
    : GIF_FRAME_LIMITS.fallback
  cfg.svgModel = String(cfg.svgModel || DEFAULTS.svgModel)
  cfg.moderation = cfg.moderation === 'low' ? 'low' : 'auto'
  const compression = Number(cfg.outputCompression)
  cfg.outputCompression = Number.isFinite(compression)
    ? Math.min(100, Math.max(0, Math.trunc(compression)))
    : 0
  const fps = Number(cfg.gifFps)
  cfg.gifFps = Number.isFinite(fps) ? Math.min(50, Math.max(0, Math.trunc(fps))) : 0
  return cfg
}
