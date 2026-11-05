import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, mergeConfig, normalizeConfig } from '../lib/config.js'

test('mergeConfig keeps live values when the waterfall payload is partial', () => {
  const live = normalizeConfig({ outputFormat: 'gif', size: '512x512', model: 'gpt-image-2.6-sunburst' })
  const merged = mergeConfig(live, { robloxEnabled: false })
  assert.equal(merged.outputFormat, 'gif', 'a roblox-only edit must not reset the output format')
  assert.equal(merged.size, '512x512')
  assert.equal(merged.model, 'gpt-image-2.6-sunburst')
  assert.equal(merged.robloxEnabled, false)
})

test('mergeConfig applies a real change and keeps the rest', () => {
  const live = normalizeConfig({ outputFormat: 'gif', quality: 'low' })
  const merged = mergeConfig(live, { outputFormat: 'webp', quality: 'high' })
  assert.equal(merged.outputFormat, 'webp')
  assert.equal(merged.quality, 'high')
  assert.equal(merged.model, DEFAULTS.model)
})

test('mergeConfig ignores junk payloads instead of wiping the config', () => {
  const live = normalizeConfig({ outputFormat: 'gif' })
  assert.equal(mergeConfig(live, null).outputFormat, 'gif')
  assert.equal(mergeConfig(live, 'nope').outputFormat, 'gif')
  assert.equal(mergeConfig(live, [1, 2]).outputFormat, 'gif')
})
