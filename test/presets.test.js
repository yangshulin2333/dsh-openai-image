import test from 'node:test'
import assert from 'node:assert/strict'
import { PRESET_NAMES, ROBLOX_PRESETS, applyPreset, buildPresetPrompt, getPreset } from '../lib/presets.js'

test('every preset is complete', () => {
  for (const name of PRESET_NAMES) {
    const preset = ROBLOX_PRESETS[name]
    assert.equal(typeof preset.size, 'string', `${name} needs a size`)
    assert.equal(typeof preset.format, 'string', `${name} needs a format`)
    assert.ok(preset.suffix.length > 20, `${name} needs a descriptive prompt suffix`)
  }
  assert.ok(PRESET_NAMES.includes('game_icon'))
  assert.ok(PRESET_NAMES.includes('ui_9slice'))
})

test('applyPreset fills size/format/background', () => {
  const { presetName, params } = applyPreset({ prompt: 'x' }, {}, 'decal')
  assert.equal(presetName, 'decal')
  assert.equal(params.size, '1024x1024')
  assert.equal(params.output_format, 'png')
  assert.equal(params.background, 'transparent')
})

test('explicit arguments win over the preset', () => {
  const { params } = applyPreset({ prompt: 'x', size: '1536x1024' }, {}, 'game_icon')
  assert.equal(params.size, '1536x1024')
})

test('cfg.defaultPreset is used when the call names none', () => {
  const { presetName } = applyPreset({ prompt: 'x' }, { defaultPreset: 'thumbnail' })
  assert.equal(presetName, 'thumbnail')
})

test('unknown preset throws and lists the valid ones', () => {
  assert.throws(() => applyPreset({ prompt: 'x' }, {}, 'poster'), /Unknown preset "poster"/)
  assert.throws(() => applyPreset({ prompt: 'x' }, {}, 'poster'), /game_icon/)
})

test('getPreset tolerates empty values', () => {
  assert.equal(getPreset(''), undefined)
  assert.equal(getPreset(undefined), undefined)
})

test('buildPresetPrompt keeps prompt, suffix and cfg.promptSuffix', () => {
  const preset = getPreset('game_icon')
  const prompt = buildPresetPrompt('a fox knight', preset, { promptSuffix: 'no text' })
  assert.ok(prompt.startsWith('a fox knight\n\n'))
  assert.ok(prompt.includes(preset.suffix))
  assert.ok(prompt.endsWith('no text'))
})

test('ui_9slice ships a slice hint', () => {
  assert.deepEqual(ROBLOX_PRESETS.ui_9slice.sliceHint, { sliceCenter: [256, 256], sliceScale: 1 })
})
