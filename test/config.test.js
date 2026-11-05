import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, normalizeConfig } from '../lib/config.js'

test('normalizeConfig returns the documented defaults', () => {
  const cfg = normalizeConfig(undefined)
  assert.equal(cfg.model, 'gpt-image-2.6-flare')
  assert.equal(cfg.size, '1024x1024')
  assert.equal(cfg.apiKeyEnv, 'OPENAI_API_KEY')
  assert.equal(cfg.robloxApiKeyEnv, 'ROBLOX_API_KEY')
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.robloxEnabled, false)
  assert.equal(cfg.retries, DEFAULTS.retries)
})

test('normalizeConfig trims the base url and drops trailing slashes', () => {
  assert.equal(normalizeConfig({ baseURL: 'https://api.openai.com/v1/' }).baseURL, 'https://api.openai.com/v1')
  assert.equal(normalizeConfig({ baseURL: 'http://127.0.0.1:8787/v1///' }).baseURL, 'http://127.0.0.1:8787/v1')
})

test('robloxEnabled is strict: only true enables uploads', () => {
  assert.equal(normalizeConfig({ robloxEnabled: true }).robloxEnabled, true)
  assert.equal(normalizeConfig({ robloxEnabled: 'true' }).robloxEnabled, false)
  assert.equal(normalizeConfig({ robloxEnabled: 1 }).robloxEnabled, false)
})

test('normalizeConfig ignores null and undefined overrides', () => {
  const cfg = normalizeConfig({ model: null, size: undefined, quality: 'high' })
  assert.equal(cfg.model, DEFAULTS.model)
  assert.equal(cfg.size, DEFAULTS.size)
  assert.equal(cfg.quality, 'high')
})

test('numeric settings fall back when invalid', () => {
  assert.equal(normalizeConfig({ timeoutMs: -1 }).timeoutMs, DEFAULTS.timeoutMs)
  assert.equal(normalizeConfig({ retries: -3 }).retries, DEFAULTS.retries)
  assert.equal(normalizeConfig({ retries: 0 }).retries, 0)
})

test('strings are trimmed and creator id defaults to empty', () => {
  assert.equal(normalizeConfig({ promptSuffix: '  no text  ' }).promptSuffix, 'no text')
  assert.equal(normalizeConfig({}).robloxCreatorId, '')
})
