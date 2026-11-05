import { readFile, writeFile } from 'node:fs/promises'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ASSET_TYPES, uploadAsset, validateRobloxImage } from '../roblox.js'
import { assertFileExists, cwdOf, resolveUserPath } from '../paths.js'
import { uploadOutput } from '../output.js'

export function registerUploadTool(ctx, cfg, log) {
  return ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'roblox_upload',
          description:
            'Upload a local PNG/JPEG to Roblox as a Decal or Image asset and return its rbxassetid://. ' +
            'This creates a real asset on the Roblox account, so it stays off until robloxEnabled is on in the settings, ' +
            'and it only uploads when confirm=true — otherwise it returns a summary of the planned upload so the agent can ask the user first.',
          parameters: {
            image: {
              type: 'string',
              required: true,
              description: 'Path of the image file to upload (png, jpg, bmp or tga; under 20 MB and 8000x8000).',
            },
            confirm: {
              type: 'boolean',
              description:
                'Set to true only after the user explicitly agreed to publish this asset to Roblox. Omitted or false never uploads.',
            },
            display_name: {
              type: 'string',
              description: 'Asset name shown in the Roblox Creator Dashboard (max 50 characters). Defaults to the file name.',
            },
            description: {
              type: 'string',
              description: 'Optional asset description.',
            },
            asset_type: {
              type: 'string',
              enum: ASSET_TYPES,
              description: 'Decal (default, what Studio shows in the Toolbox) or Image.',
            },
            creator_type: {
              type: 'string',
              enum: ['user', 'group'],
              description: 'Upload as a personal asset or a group asset. Defaults to the plugin setting.',
            },
            creator_id: {
              type: 'string',
              description: 'Roblox user id or group id owning the asset. Defaults to the plugin setting.',
            },
          },
          output: uploadOutput,
          execute: async (args = {}, exec) => {
            if (!cfg.enabled) throw new Error('dsh-openai-image is disabled (config.enabled = false)')
            const cwd = cwdOf(exec)
            const input = String(args.image || '').trim()
            if (!input) throw new Error('image is required (path to a png/jpeg file)')
            const filePath = assertFileExists(resolveUserPath(input, cwd), 'Image to upload')
            const bytes = await readFile(filePath)
            const checked = validateRobloxImage({ bytes, fileName: filePath })
            const assetType = args.asset_type || cfg.robloxAssetType || 'Decal'
            const creatorType = args.creator_type || cfg.robloxCreatorType || 'user'
            const creatorId = String(args.creator_id || cfg.robloxCreatorId || '')
            const displayName = String(args.display_name || filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'image')

            if (!cfg.robloxEnabled) {
              throw new Error(
                'Roblox uploads are switched off. Turn on "Enable Roblox upload" (robloxEnabled) in the plugin settings, ' +
                  'then set robloxCreatorId to your Roblox user id (or group id for group assets).',
              )
            }
            if (args.confirm !== true) {
              return {
                summary: [
                  'Upload **not** performed: roblox_upload requires `confirm: true`.',
                  `\n\nPlanned upload: \`${filePath}\``,
                  ` (${checked.bytes ? Math.round(checked.bytes / 1024) : 0} KB${checked.dimensions ? `, ${checked.dimensions.width}x${checked.dimensions.height}` : ''})`,
                  ` as ${assetType} for ${creatorType} ${creatorId || '(creator id not set)'}, name "${displayName}".`,
                  '\n\nAsk the user first; uploads create public Roblox assets and cannot be updated later.',
                ].join(''),
                action: 'confirm_required',
                needs_confirmation: true,
                path: filePath,
                asset_type: assetType,
                display_name: displayName,
              }
            }
            if (!creatorId) {
              throw new Error(
                'robloxCreatorId is empty. Set your Roblox user id (https://www.roblox.com/users/<id>/profile) or a group id ' +
                  'in the plugin settings, then retry.',
              )
            }

            const result = await uploadAsset(ctx, cfg, {
              filePath,
              displayName,
              description: args.description,
              assetType,
              creatorType,
              creatorId,
              log,
            })
            await mergeSidecar(filePath, {
              assetId: result.assetId,
              rbxassetid: result.rbxassetid,
              assetType: result.assetType,
              moderationState: result.moderationState,
              uploadedAt: new Date().toISOString(),
            }).catch(() => {})

            log(`dsh-openai-image: uploaded ${filePath} as ${result.rbxassetid} (${result.moderationState})`)
            return {
              summary: [
                `Uploaded **${result.displayName}** to Roblox as ${result.assetType}.`,
                `\n\n- asset id: \`${result.assetId}\``,
                `\n- reference: \`${result.rbxassetid}\``,
                `\n- moderation: ${result.moderationState}`,
                `\n- ${(result.durationMs / 1000).toFixed(1)}s`,
                String(result.moderationState || '').toUpperCase().includes('APPROVED')
                  ? ''
                  : '\n\nModeration may still be pending; it must be approved before the asset renders in-game.',
              ].join(''),
              action: 'uploaded',
              needs_confirmation: false,
              path: filePath,
              asset_id: result.assetId,
              rbxassetid: result.rbxassetid,
              asset_type: result.assetType,
              moderation_state: result.moderationState,
              display_name: result.displayName,
              duration_ms: result.durationMs,
              luau: `local image = "${result.rbxassetid}"\n-- ImageLabel: imageLabel.Image = image\n-- SurfaceAppearance / Texture: texture.Texture = image`,
            }
          },
        }),
      ),
    'dsh-openai-image: tool roblox_upload',
  )
}

async function mergeSidecar(filePath, roblox) {
  const sidecarPath = `${filePath}.json`
  const existing = JSON.parse(await readFile(sidecarPath, 'utf8'))
  const merged = { ...existing, roblox }
  await writeFile(sidecarPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
}
