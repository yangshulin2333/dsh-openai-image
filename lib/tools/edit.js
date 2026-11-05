import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  ASPECT_TO_SIZE,
  INPUT_FIDELITIES,
  assertMaskHasAlpha,
  assertTransparentCombination,
  buildEditForm,
  callImagesApi,
  clampFrameCount,
  materialize,
  resolveGifSize,
  resolveSize,
  retimeGif,
} from '../openai.js'
import { BACKGROUNDS, FORMATS, GIF_FRAME_LIMITS, GIF_SIZES, MODEL_SUGGESTIONS, MODERATIONS, QUALITIES, SIZES } from '../config.js'
import { PRESET_NAMES, applyPreset, buildPresetPrompt } from '../presets.js'
import { assertFileExists, cwdOf, markdownImagePath, resolveUserPath } from '../paths.js'
import { imageOutput } from '../output.js'

// Editing can also animate: the API accepts output_format=gif plus frame_count
// on /images/edits. Vector output stays generation-only (svg is rejected there).
const EDIT_FORMATS = FORMATS.filter((format) => format !== 'svg')

export function registerEditTool(ctx, cfg, log) {
  return ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'image_edit',
          description:
            'Edit, repaint or restyle existing images through the OpenAI Images API (multi-image input, optional PNG mask). ' +
            'Set output_format=gif to turn an existing picture into a short animation. Saves the result into the workspace.',
          parameters: {
            prompt: {
              type: 'string',
              required: true,
              description: 'What to change in the source image(s). For animation, describe the beats frame by frame.',
            },
            image: {
              type: 'string',
              required: true,
              description: 'Source image path, or several paths separated by commas (up to 16).',
            },
            mask: {
              type: 'string',
              description: 'Optional PNG mask with an alpha channel; transparent pixels mark the area to repaint.',
            },
            preset: {
              type: 'string',
              enum: PRESET_NAMES,
              description: `Optional Roblox preset for the output framing: ${PRESET_NAMES.join(', ')}.`,
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
                `Default: ${cfg.size}. gif only accepts ${GIF_SIZES.join(' or ')}.`,
            },
            aspect_ratio: {
              type: 'string',
              enum: Object.keys(ASPECT_TO_SIZE),
              description: 'Convenience alias mapped to the closest supported size (overrides size).',
            },
            quality: {
              type: 'string',
              enum: QUALITIES,
              description: `Rendering quality. Default: ${cfg.quality}.`,
            },
            count: {
              type: 'integer',
              description: 'How many variations to produce (1-10). Default: 1.',
            },
            output_format: {
              type: 'string',
              enum: EDIT_FORMATS,
              description:
                `Image format. Default: ${cfg.outputFormat}. gif turns the edit into a short animation; ` +
                'svg is only available from image_generate.',
            },
            frame_count: {
              type: 'integer',
              description: `GIF frames (${GIF_FRAME_LIMITS.min}-${GIF_FRAME_LIMITS.max}). Default: ${cfg.frameCount}. Only used when output_format is gif.`,
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
            background: {
              type: 'string',
              enum: BACKGROUNDS,
              description: 'Background handling for the edited image; transparent requires png or webp.',
            },
            input_fidelity: {
              type: 'string',
              enum: INPUT_FIDELITIES,
              description: 'How closely to preserve the source images (faces, logos, fine detail). The 2.6 models do not take it (it is dropped automatically); use it with older models such as gpt-image-1.5.',
            },
            user: {
              type: 'string',
              description: 'Optional end-user identifier forwarded to the API for abuse tracking.',
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
            const cwd = cwdOf(exec)
            const { presetName, preset, params } = applyPreset(args, cfg)
            const fullPrompt = buildPresetPrompt(prompt, preset, cfg)

            const sourcePaths = String(params.image || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            if (sourcePaths.length === 0) throw new Error('image_edit requires at least one source image path')
            if (sourcePaths.length > 16) throw new Error('image_edit accepts at most 16 source images')

            const sources = []
            for (const sourcePath of sourcePaths) {
              const absolute = assertFileExists(resolveUserPath(sourcePath, cwd), 'Source image')
              sources.push({ name: path.basename(absolute), bytes: await readFile(absolute) })
            }
            let mask
            if (params.mask) {
              const maskPath = assertFileExists(resolveUserPath(String(params.mask), cwd), 'Mask image')
              mask = { name: path.basename(maskPath), bytes: assertMaskHasAlpha(await readFile(maskPath)) }
            }

            if (params.output_format === 'svg') {
              throw new Error('image_edit cannot produce svg: the edits endpoint only returns png/webp/jpeg/gif. Use image_generate for vector output.')
            }
            // A default of svg (set for image_generate) must not make every edit
            // fail: edits fall back to png unless the call asks for something else.
            const format = params.output_format || (EDIT_FORMATS.includes(cfg.outputFormat) ? cfg.outputFormat : 'png')
            assertTransparentCombination(format, params.background)
            const resolvedSize = format === 'gif' ? resolveGifSize(params, cfg) : resolveSize(params, cfg)

            const model = params.model || cfg.model
            const fps = Number(params.gif_fps ?? cfg.gifFps) || 0
            const buildForm = (extraArgs = {}) =>
              buildEditForm({
                args: { ...params, model, ...extraArgs },
                cfg,
                prompt: fullPrompt,
                sources,
                mask,
                format,
              })

            const started = Date.now()
            let fidelityNote = ''
            let payload
            try {
              payload = await callImagesApi(ctx, cfg, { endpoint: '/images/edits', form: buildForm() }, log)
            } catch (error) {
              // Not every model takes input_fidelity, and the API only says so
              // after validating the value. Drop it once instead of failing.
              if (!params.input_fidelity || !/input_fidelity/.test(String(error?.message))) throw error
              fidelityNote = ` input_fidelity is not supported by ${model}, so it was dropped.`
              log(`dsh-openai-image: ${model} rejected input_fidelity, retrying without it`)
              payload = await callImagesApi(ctx, cfg, { endpoint: '/images/edits', form: buildForm({ input_fidelity: undefined }) }, log)
            }
            const images = await materialize(payload, {
              args: params,
              cfg,
              format,
              cwd,
              stem: params.output_name,
              ctx,
              postProcess: format === 'gif' && fps > 0 ? (bytes) => retimeGif(bytes, fps) : undefined,
              extra: {
                model,
                prompt: fullPrompt,
                preset: presetName,
                size: resolvedSize,
                quality: params.quality || cfg.quality,
                format,
                source_images: sources.map((item) => item.name),
              },
            })
            const duration = Date.now() - started
            log(`dsh-openai-image: edited ${sources.length} source image(s) with ${model} in ${duration}ms`)

            const first = images[0]
            const resolvedQuality = params.quality || cfg.quality || 'auto'
            const detail = [
              resolvedSize,
              `quality=${resolvedQuality}`,
              format === 'gif' ? `frames=${clampFrameCount(params.frame_count ?? cfg.frameCount)}${fps > 0 ? ` @${fps}fps` : ''}` : '',
              presetName ? `preset=${presetName}` : '',
            ].filter(Boolean).join(', ')
            return {
              summary: [
                `Edited ${sources.length} image${sources.length === 1 ? '' : 's'} into ${format || 'png'} with \`${model}\``,
                ` (${detail}, ${(duration / 1000).toFixed(1)}s).${fidelityNote}`,
                first ? `\n\n![edited image](${markdownImagePath(first.path)})` : '',
              ].join(''),
              action: 'edited',
              model,
              size: resolvedSize,
              quality: resolvedQuality,
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
    'dsh-openai-image: tool image_edit',
  )
}

function requirePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : ''
  if (!prompt) throw new Error('prompt is required')
  return prompt
}
