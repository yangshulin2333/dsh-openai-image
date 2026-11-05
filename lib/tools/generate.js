import { defineTool } from '@deepseek-ai/dsh-tools'
import { ASPECT_TO_SIZE, assertTransparentCombination, buildGenerationBody, callImagesApi, materialize, retimeGif } from '../openai.js'
import { BACKGROUNDS, FORMATS, GIF_FRAME_LIMITS, GIF_SIZES, MODEL_SUGGESTIONS, MODERATIONS, QUALITIES, SIZES } from '../config.js'
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
              description:
                `Image model id. Default: ${cfg.model}. Any image model on the account works: ${MODEL_SUGGESTIONS.join(', ')}` +
                '. gif/svg output needs a 2.6 model.',
            },
            size: {
              type: 'string',
              description:
                `Output size as WIDTHxHEIGHT (sides divisible by 16, longest edge <= 3840). ` +
                `Common: ${SIZES.join(', ')}. Default: ${cfg.size}. gif only accepts ${GIF_SIZES.join(' or ')}.`,
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
              description: 'How many images to create (1-10). Default: 1.',
            },
            output_format: {
              type: 'string',
              enum: FORMATS,
              description:
                `Image format. Default: ${cfg.outputFormat}. png/jpeg/webp are stills; gif is a short loop ` +
                `(${GIF_SIZES.join(' or ')} only); svg is a vector drawing made by a text model. Roblox needs png or jpeg.`,
            },
            frame_count: {
              type: 'integer',
              description: `GIF frames (${GIF_FRAME_LIMITS.min}-${GIF_FRAME_LIMITS.max}). Default: ${cfg.frameCount}. Only used when output_format is gif.`,
            },
            svg_model: {
              type: 'string',
              description: `Text model that writes the SVG. Default: ${cfg.svgModel}. Only used when output_format is svg.`,
            },
            gif_fps: {
              type: 'integer',
              description: 'Retime the finished GIF to this frame rate (1-50). 0 keeps the API timing (5 fps).',
            },
            moderation: {
              type: 'string',
              enum: MODERATIONS,
              description: `Safety filter strength. Default: ${cfg.moderation}. "low" relaxes it.`,
            },
            output_compression: {
              type: 'integer',
              description: 'Compression 0-100 for jpeg/webp. 0 leaves it to the API.',
            },
            safety_identifier: {
              type: 'string',
              description: 'Optional stable, hashed end-user id for OpenAI abuse monitoring (the successor of user).',
            },
            partial_images: {
              type: 'integer',
              description: 'Stream 1-3 low-detail preview images while rendering and save them next to the result (as -partial-N). 0 = off.',
            },
            user: {
              type: 'string',
              description: 'Optional end-user identifier forwarded to the API for abuse tracking.',
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
            if (format === 'gif' && params.background === 'transparent') {
              throw new Error('gif output cannot use a transparent background')
            }

            const body = buildGenerationBody(params, cfg, fullPrompt)
            const fps = Number(params.gif_fps ?? cfg.gifFps) || 0
            const started = Date.now()
            const payload = await callImagesApi(ctx, cfg, { endpoint: '/images/generations', json: body }, log)
            const images = await materialize(payload, {
              args: params,
              cfg,
              format,
              cwd: cwdOf(exec),
              stem: params.output_name,
              ctx,
              postProcess: format === 'gif' && fps > 0 ? (bytes) => retimeGif(bytes, fps) : undefined,
              extra: {
                model: body.model,
                prompt: fullPrompt,
                preset: presetName,
                size: body.size || (format === 'svg' ? 'vector' : undefined),
                quality: body.quality,
                format,
              },
            })
            const duration = Date.now() - started
            log(`dsh-openai-image: generated ${images.length} image(s) with ${body.model} in ${duration}ms`)

            const first = images[0]
            const detail = [
              body.size || (format === 'svg' ? `vector via ${body.svg?.model}` : 'auto'),
              `quality=${body.quality || 'auto'}`,
              body.frame_count ? `frames=${body.frame_count}${fps > 0 ? ` @${fps}fps` : ''}` : '',
              body.moderation ? `moderation=${body.moderation}` : '',
              body.output_compression ? `compression=${body.output_compression}` : '',
              presetName ? `preset=${presetName}` : '',
            ].filter(Boolean).join(', ')
            const maker = format === 'svg' ? `${body.model} → ${body.svg?.model}` : body.model
            const summary = [
              `Generated ${images.length} image${images.length === 1 ? '' : 's'} with \`${maker}\` `,
              `(${detail}, `,
              `${(duration / 1000).toFixed(1)}s).`,
              first ? `\n\n![generated image](${markdownImagePath(first.path)})` : '',
            ].join('')
            return {
              summary,
              action: 'generated',
              model: body.model,
              size: body.size || (format === 'svg' ? 'vector' : 'auto'),
              quality: body.quality || 'auto',
              preset: presetName,
              count: images.length,
              duration_ms: duration,
              path: first.path,
              prompt: fullPrompt,
              revised_prompt: first.revisedPrompt || '',
              files: images.map((item) => ({ path: item.path, bytes: item.bytes, format: item.format })),
              ...(first.partials?.length ? { partials: first.partials } : {}),
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
