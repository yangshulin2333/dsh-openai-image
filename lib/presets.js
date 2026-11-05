// Roblox-flavoured presets.
//
// They are deliberately *prompt + size + format* only: no post-processing, no
// hidden model calls. Everything the preset adds is visible in the result so a
// user can copy the prompt and reproduce it by hand.

export const ROBLOX_PRESETS = {
  game_icon: {
    size: '1024x1024',
    format: 'png',
    note: 'Roblox 游戏图标，商店与列表里会缩到很小。',
    suffix:
      'Roblox game icon, one centered subject filling 70% of the frame, bold readable silhouette at 150px, thick shapes, strong contrast, simple flat background, no small text, no watermark, no border',
  },
  thumbnail: {
    size: '1536x1024',
    format: 'png',
    note: '游戏缩略图/宣传图，16:9 显示时会被裁切，主体偏右。',
    suffix:
      'Roblox game thumbnail key art, cinematic lighting, main subject on the right third, left third kept simple for a title overlay, punchy saturated colors, no text, no watermark',
  },
  gamepass: {
    size: '1024x1024',
    format: 'png',
    note: '通行证/商品图标，方块显示。',
    suffix:
      'Roblox game pass storefront icon, single emblem centered, glossy rim light, dark vignette background, no text, no watermark',
  },
  badge: {
    size: '1024x1024',
    format: 'png',
    note: '成就徽章。',
    suffix:
      'achievement badge emblem, symmetrical, centered, metallic bevel, soft glow ring, transparent-friendly flat background, no text, no watermark',
  },
  decal: {
    size: '1024x1024',
    format: 'png',
    background: 'transparent',
    note: '通用贴花，透明背景，可直接 rbxassetid 贴。',
    suffix:
      'standalone decal asset, isolated subject, fully transparent background, clean crisp edges, no drop shadow, no floor, no text, no watermark',
  },
  ui_9slice: {
    size: '1024x1024',
    format: 'png',
    note: '九宫格 UI 面板；边缘等宽、中部纯色，可任意拉伸。',
    sliceHint: { sliceCenter: [256, 256], sliceScale: 1 },
    suffix:
      'Roblox UI panel designed for 9-slice stretching: uniform border thickness on all four sides, identical corner ornaments, perfectly flat solid color in the center, no gradients across the middle, no text, no watermark',
  },
  seamless_texture: {
    size: '1024x1024',
    format: 'png',
    note: '无缝平铺材质贴图。',
    suffix:
      'seamlessly tileable texture for 3D material, edge-to-edge continuity, uniform lighting, no vignette, no border, no focal object, no text, flat orthographic view',
  },
}

export const PRESET_NAMES = Object.keys(ROBLOX_PRESETS)

export function getPreset(name) {
  const key = String(name || '').trim()
  if (!key) return undefined
  return ROBLOX_PRESETS[key]
}

/**
 * Merge a preset into call parameters. Explicit call arguments win over the
 * preset, and the preset suffix is always appended (it describes the framing
 * constraints, not the subject).
 */
export function applyPreset(params, cfg, presetName) {
  const name = String(presetName || params?.preset || cfg?.defaultPreset || '').trim()
  const preset = getPreset(name)
  if (!name) return { presetName: '', preset: undefined, params: { ...params } }
  if (!preset) {
    throw new Error(
      `Unknown preset "${name}". Available presets: ${PRESET_NAMES.join(', ')}.`,
    )
  }
  const merged = { ...params }
  if (!merged.size && !merged.aspect_ratio) merged.size = preset.size
  if (!merged.output_format && preset.format) merged.output_format = preset.format
  if (!merged.background && preset.background) merged.background = preset.background
  if (!merged.quality && preset.quality) merged.quality = preset.quality
  return { presetName: name, preset, params: merged }
}

export function buildPresetPrompt(prompt, preset, cfg) {
  const parts = [String(prompt || '').trim()]
  if (preset?.suffix) parts.push(preset.suffix)
  if (cfg?.promptSuffix) parts.push(cfg.promptSuffix)
  return parts.filter(Boolean).join('\n\n')
}
