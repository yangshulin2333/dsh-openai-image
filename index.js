// dsh-openai-image — OpenAI Images 2.6 tools for DSH, with an optional
// Roblox Open Cloud upload step.
//
// Host-only bundle: package.json + this file + cordis.patch.yml is everything
// the host needs. Three tools are registered:
//   image_generate — POST /v1/images/generations
//   image_edit     — POST /v1/images/edits (multi-image + optional mask)
//   roblox_upload  — POST apis.roblox.com/assets/v1/assets (opt-in, confirm-gated)

import { Config, normalizeConfig } from './lib/config.js'
import { registerSettingsRoutes } from './lib/routes.js'
import { registerGenerateTool } from './lib/tools/generate.js'
import { registerEditTool } from './lib/tools/edit.js'
import { registerUploadTool } from './lib/tools/upload.js'

export const name = 'dsh-openai-image'
export const inject = ['tools']

export { Config }

export function apply(ctx, rawConfig) {
  const cfg = normalizeConfig(rawConfig)
  const log = (message) => {
    try {
      ctx.logger?.info?.(message)
    } catch {
      // logging must never break a tool call
    }
  }

  registerGenerateTool(ctx, cfg, log)
  registerEditTool(ctx, cfg, log)
  registerUploadTool(ctx, cfg, log)

  // The web server may not exist yet while this plugin applies (a headless
  // profile never has one), so the routes wait for it instead of vanishing.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (sctx) => {
      try {
        registerSettingsRoutes(sctx, { cfg })
      } catch (error) {
        log(`settings routes unavailable: ${error && error.message ? error.message : error}`)
      }
    })
  } else {
    registerSettingsRoutes(ctx, { cfg })
  }

  log(
    `dsh-openai-image ready: model=${cfg.model} size=${cfg.size} quality=${cfg.quality} ` +
      `roblox=${cfg.robloxEnabled ? `on (${cfg.robloxCreatorType} ${cfg.robloxCreatorId || 'no-creator-id'})` : 'off'}`,
  )
}
