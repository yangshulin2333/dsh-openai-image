import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  ASPECT_TO_SIZE,
  assertTransparentCombination,
  callImagesApi,
  clampCount,
  materialize,
  resolveSize,
} from '../openai.js'
import { FORMATS, QUALITIES, SIZES } from '../config.js'
import { PRESET_NAMES, applyPreset, buildPresetPrompt } from '../presets.js'
import { assertFileExists, cwdOf, markdownImagePath, mimeOf, resolveUserPath } from '../paths.js'
import { imageOutput } from '../output.js'

export function registerEditTool(ctx, cfg, log) {
  return ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'image_edit',
          description:
            'Edit, repaint or restyle existing images through the OpenAI Images API (multi-image input, optional PNG mask). ' +
            'Saves the result into the workspace.',
          parameters: {
            prompt: {
              type: 'string',
              required: true,
              description: 'What to change in the source image(s).',
            },
            image: {
              type: 'string',
              required: true,
              description: 'Source image path, or several paths separated by commas (up to 8).',
            },
            mask: {
              type: 'string',
              description: 'Optional PNG mask; transparent pixels mark the area to repaint.',
            },
            preset: {
              type: 'string',
              enum: PRESET_NAMES,
              description: `Optional Roblox preset for the output framing: ${PRESET_NAMES.join(', ')}.`,
            },
            model: {
              type: 'string',
              description: `Model id. Default: ${cfg.model}.`,
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
              description: `Rendering quality. Default: ${cfg.quality}.`,
            },
            count: {
              type: 'integer',
              description: 'How many variations to produce (1-4). Default: 1.',
            },
            output_format: {
              type: 'string',
              enum: FORMATS,
              description: `Image format. Default: ${cfg.outputFormat}.`,
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
            if (sourcePaths.length > 8) throw new Error('image_edit accepts at most 8 source images')

            const sources = []
            for (const sourcePath of sourcePaths) {
              const absolute = assertFileExists(resolveUserPath(sourcePath, cwd), 'Source image')
              sources.push({ name: path.basename(absolute), bytes: await readFile(absolute) })
            }
            let mask
            if (params.mask) {
              const maskPath = assertFileExists(resolveUserPath(String(params.mask), cwd), 'Mask image')
              mask = { name: path.basename(maskPath), bytes: await readFile(maskPath) }
            }

            const format = params.output_format || cfg.outputFormat
            if (format === 'gif' || format === 'svg') {
              throw new Error(`image_edit outputs still images only; ${format} is available from image_generate`)
            }
            assertTransparentCombination(format, params.background)
            const model = params.model || cfg.model
            const size = resolveSize(params, cfg)
            const quality = params.quality || cfg.quality
            const count = clampCount(params.count)

            const form = new FormData()
            form.append('model', model)
            form.append('prompt', fullPrompt)
            form.append('n', String(count))
            if (size && size !== 'auto') form.append('size', size)
            if (quality && quality !== 'auto') form.append('quality', quality)
            if (format) form.append('output_format', format)
            for (const source of sources) {
              form.append('image', new Blob([source.bytes], { type: mimeOf(source.name) }), source.name)
            }
            if (mask) form.append('mask', new Blob([mask.bytes], { type: 'image/png' }), 'mask.png')

            const started = Date.now()
            const payload = await callImagesApi(ctx, cfg, { endpoint: '/images/edits', form }, log)
            const images = await materialize(payload, {
              args: params,
              cfg,
              format,
              cwd,
              stem: params.output_name,
              ctx,
              extra: {
                model,
                prompt: fullPrompt,
                preset: presetName,
                size,
                quality,
                format,
                source_images: sources.map((item) => item.name),
              },
            })
            const duration = Date.now() - started
            log(`dsh-openai-image: edited ${sources.length} source image(s) with ${model} in ${duration}ms`)

            const first = images[0]
            return {
              summary: [
                `Edited ${sources.length} image${sources.length === 1 ? '' : 's'} with \`${model}\``,
                ` (${size}, quality=${quality || 'auto'}, ${(duration / 1000).toFixed(1)}s).`,
                first ? `\n\n![edited image](${markdownImagePath(first.path)})` : '',
              ].join(''),
              action: 'edited',
              model,
              size,
              quality: quality || 'auto',
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
    'dsh-openai-image: tool image_edit',
  )
}

function requirePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : ''
  if (!prompt) throw new Error('prompt is required')
  return prompt
}
