import { defineTool } from '@deepseek-ai/dsh-tools'
import { ASPECT_TO_SIZE, assertTransparentCombination, buildGenerationBody, callImagesApi, materialize } from '../openai.js'
import { BACKGROUNDS, FORMATS, QUALITIES, SIZES } from '../config.js'
import { PRESET_NAMES, applyPreset, buildPresetPrompt } from '../presets.js'
import { cwdOf, markdownImagePath } from '../paths.js'
import { imageOutput } from '../output.js'

export function registerGenerateTool(ctx, cfg, log) {
  return ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'image_generate',
          description:
            'Generate an image with the OpenAI Images API (gpt-image-2.6 family) and save it into the workspace. ' +
            'Use a Roblox preset (game_icon, thumbnail, decal, ui_9slice, seamless_texture, ...) to get the right ' +
            'framing and size for a Roblox asset. Use image_edit to change an existing picture.',
          parameters: {
            prompt: {
              type: 'string',
              required: true,
              description: 'Detailed description of the image to create.',
            },
            preset: {
              type: 'string',
              enum: PRESET_NAMES,
              description: `Roblox preset. It sets size/format/background and appends framing constraints: ${PRESET_NAMES.join(', ')}.`,
            },
            model: {
              type: 'string',
              description: `Model id. Default: ${cfg.model}. gpt-image-2.6-flare is the fast one, gpt-image-2.6-sunburst the detailed one.`,
            },
            size: {
              type: 'string',
              enum: SIZES,
              description: `Output size. Default: ${cfg.size}.`,
            },
            aspect_ratio: {
              type: 'string',
              enum: Object.keys(ASPECT_TO_SIZE),
              description: 'Convenience alias mapped to the closest supported size (overrides size).',
            },
            quality: {
              type: 'string',
              enum: QUALITIES,
              description: `Rendering quality. Default: ${cfg.quality}. low is fastest (~6s with flare), high the most detailed.`,
            },
            count: {
              type: 'integer',
              description: 'How many images to create (1-4). Default: 1.',
            },
            output_format: {
              type: 'string',
              enum: FORMATS,
              description: `Image format. Default: ${cfg.outputFormat}. Roblox needs png or jpeg.`,
            },
            background: {
              type: 'string',
              enum: BACKGROUNDS,
              description: 'Background handling; transparent requires png or webp.',
            },
            output_name: {
              type: 'string',
              description: 'Optional file name stem for the saved image.',
            },
            output_dir: {
              type: 'string',
              description: `Optional directory for the saved image. Default: ${cfg.outputDir}.`,
            },
          },
          output: imageOutput,
          execute: async (args = {}, exec) => {
            if (!cfg.enabled) throw new Error('dsh-openai-image is disabled (config.enabled = false)')
            const prompt = requirePrompt(args.prompt)
            const { presetName, preset, params } = applyPreset(args, cfg)
            const fullPrompt = buildPresetPrompt(prompt, preset, cfg)
            const format = params.output_format || cfg.outputFormat
            assertTransparentCombination(format, params.background)

            const body = buildGenerationBody(params, cfg, fullPrompt)
            const started = Date.now()
            const payload = await callImagesApi(ctx, cfg, { endpoint: '/images/generations', json: body }, log)
            const images = await materialize(payload, {
              args: params,
              cfg,
              format,
              cwd: cwdOf(exec),
              stem: params.output_name,
              ctx,
              extra: {
                model: body.model,
                prompt: fullPrompt,
                preset: presetName,
                size: body.size,
                quality: body.quality,
                format,
              },
            })
            const duration = Date.now() - started
            log(`dsh-openai-image: generated ${images.length} image(s) with ${body.model} in ${duration}ms`)

            const first = images[0]
            const summary = [
              `Generated ${images.length} image${images.length === 1 ? '' : 's'} with \`${body.model}\``,
              `(${body.size || 'auto'}, quality=${body.quality || 'auto'}${presetName ? `, preset=${presetName}` : ''}, `,
              `${(duration / 1000).toFixed(1)}s).`,
              first ? `\n\n![generated image](${markdownImagePath(first.path)})` : '',
            ].join('')
            return {
              summary,
              action: 'generated',
              model: body.model,
              size: body.size || 'auto',
              quality: body.quality || 'auto',
              preset: presetName,
              count: images.length,
              duration_ms: duration,
              path: first.path,
              prompt: fullPrompt,
              revised_prompt: first.revisedPrompt || '',
              files: images.map((item) => ({ path: item.path, bytes: item.bytes, format: item.format })),
            }
          },
        }),
      ),
    'dsh-openai-image: tool image_generate',
  )
}

function requirePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : ''
  if (!prompt) throw new Error('prompt is required')
  return prompt
}
