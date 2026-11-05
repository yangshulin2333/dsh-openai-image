// Configuration surface for dsh-openai-image.
//
// The schema is optional: when @deepseek-ai/schemastery is not resolvable
// (for example in a bare unit-test run) the plugin still works, it just has
// no settings form. In a real DSH profile the schema is what renders the
// "插件配置" panel, so keep every field documented.

export const SIZES = ['auto', '1024x1024', '1536x1024', '1024x1536']
export const QUALITIES = ['auto', 'low', 'medium', 'high']
export const FORMATS = ['png', 'jpeg', 'webp']
export const BACKGROUNDS = ['auto', 'opaque', 'transparent']
export const MODEL_SUGGESTIONS = [
  'gpt-image-2.6-flare',
  'gpt-image-2.6-sunburst',
  'gpt-image-2.6',
  'gpt-image-2.6-medium',
]

export const DEFAULTS = {
  enabled: true,
  apiKeyEnv: 'OPENAI_API_KEY',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-image-2.6-flare',
  size: '1024x1024',
  quality: 'auto',
  outputFormat: 'png',
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
        .description(`Default output format. One of: ${FORMATS.join(', ')}.`)
        .default(DEFAULTS.outputFormat),
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
  return cfg
}
