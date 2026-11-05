// dsh-openai-image — OpenAI Images 2.6 tools for DSH, with an optional
// Roblox Open Cloud upload step.
//
// Host-only bundle: package.json + this file + cordis.patch.yml is everything
// the host needs. Three tools are registered:
//   image_generate — POST /v1/images/generations
//   image_edit     — POST /v1/images/edits (multi-image + optional mask)
//   roblox_upload  — POST apis.roblox.com/assets/v1/assets (opt-in, confirm-gated)

import { Config, mergeConfig, normalizeConfig } from './lib/config.js'
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

  // Settings edits must reach the running tools without a restart. The config
  // editor runs this waterfall with the next config before reconciling, so fold
  // it into the very object every tool closure already reads.
  //
  // The waterfall payload can be partial (a single field changed from a form
  // that only knows about that field), so always merge it over the live config:
  // normalizing the payload on its own would silently reset every other field to
  // its default — that is what used to flip `outputFormat` back to png.
  if (typeof ctx.on === 'function') {
    // `internal/config` is a waterfall that fires for EVERY plugin's fiber:
    // the handler must be a plain function (so `this` is the fiber being
    // configured), must call next() to keep the chain intact, and must ignore
    // fibers that are not ours — otherwise this plugin's fields leak into every
    // other plugin's config (plan-mode, tool-result-pruner, ...) and they refuse
    // to start with "unknown key(s)".
    ctx.on('internal/config', function (_raw, nextFn) {
      const next = nextFn()
      if (this !== ctx.fiber) return next
      if (!next || typeof next !== 'object' || Array.isArray(next)) return next
      let resolved = next
      try {
        resolved = mergeConfig(cfg, next)
        Object.assign(cfg, resolved)
        log(`dsh-openai-image config updated: roblox=${cfg.robloxEnabled ? 'on' : 'off'} format=${cfg.outputFormat}`)
      } catch (error) {
        log(`dsh-openai-image config update ignored: ${error && error.message ? error.message : error}`)
      }
      // Hand the loader a complete config, not the partial payload: whatever
      // reconciles next then sees the same values the running tools already use.
      return resolved
    })
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
