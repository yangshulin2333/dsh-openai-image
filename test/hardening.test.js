import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { mergeConfig, normalizeConfig } from '../lib/config.js'
import { backoffMs, callImagesApi, writeUnique } from '../lib/openai.js'

test('normalizeConfig drops keys that are not ours', () => {
  const cfg = normalizeConfig({ outputFormat: 'gif', thresholdChars: 1000, serverName: 'x', enabled: true })
  assert.equal(cfg.outputFormat, 'gif')
  assert.equal('thresholdChars' in cfg, false)
  assert.equal('serverName' in cfg, false)
})

test('mergeConfig cannot be used to smuggle foreign keys into the live config', () => {
  const live = normalizeConfig({ outputFormat: 'gif' })
  const merged = mergeConfig(live, { headChars: 10, tailChars: 10 })
  assert.equal('headChars' in merged, false)
  assert.equal(merged.outputFormat, 'gif')
})

test('enum-like settings fall back to defaults on junk', () => {
  const cfg = normalizeConfig({ outputFormat: 'bmp', quality: 'ultra', robloxCreatorType: 'team', robloxAssetType: 'Mesh' })
  assert.equal(cfg.outputFormat, 'png')
  assert.equal(cfg.quality, 'auto')
  assert.equal(cfg.robloxCreatorType, 'user')
  assert.equal(cfg.robloxAssetType, 'Decal')
})

function mockFetch(responses) {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: next.headers })
  }
  return { calls, restore: () => (globalThis.fetch = original) }
}

const apiCfg = { apiKeyEnv: 'DSH_OPENAI_IMAGE_TEST_KEY', baseURL: 'http://127.0.0.1:9/v1', retries: 2, timeoutMs: 5000 }
process.env.DSH_OPENAI_IMAGE_TEST_KEY = 'sk-test'

test('a 400 is final and is not retried', async () => {
  const mock = mockFetch([{ status: 400, body: { error: { code: 'moderation_blocked', message: 'blocked' } } }])
  try {
    await assert.rejects(() => callImagesApi({}, apiCfg, { endpoint: '/images/generations', json: {} }), /moderation_blocked/)
    assert.equal(mock.calls.length, 1)
  } finally {
    mock.restore()
  }
})

test('a 503 is retried and the later success is returned', async () => {
  const mock = mockFetch([
    { status: 503, body: {}, headers: { 'retry-after': '0.01' } },
    { status: 200, body: { data: [{ b64_json: 'AA==' }] } },
  ])
  try {
    const payload = await callImagesApi({}, apiCfg, { endpoint: '/images/generations', json: {} })
    assert.equal(payload.data.length, 1)
    assert.equal(mock.calls.length, 2)
  } finally {
    mock.restore()
  }
})

test('backoff grows, honours Retry-After and stays capped', () => {
  assert.ok(backoffMs(2) > backoffMs(1))
  assert.equal(backoffMs(1, '3'), 3000)
  assert.equal(backoffMs(1, '600'), 30000)
  assert.ok(backoffMs(20) <= 10000)
})

test('writeUnique never overwrites an earlier image', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-openai-image-'))
  try {
    const a = await writeUnique(dir, 'cat-20261105000000', 'png', Buffer.from('a'))
    const b = await writeUnique(dir, 'cat-20261105000000', 'png', Buffer.from('b'))
    assert.notEqual(a, b)
    assert.equal((await readdir(dir)).length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('streamed responses fold back into data + partials', async () => {
  const { parseImageStream } = await import('../lib/openai.js')
  const sse = [
    'event: image_generation.partial_image\ndata: {"type":"image_generation.partial_image","b64_json":"AA==","partial_image_index":0}',
    'event: image_generation.completed\ndata: {"type":"image_generation.completed","b64_json":"AQ==","usage":{"total_tokens":42}}',
    '',
  ].join('\n\n')
  const out = parseImageStream(sse)
  assert.equal(out.data.length, 1)
  assert.equal(out.partials.length, 1)
  assert.equal(out.usage.total_tokens, 42)
  assert.throws(() => parseImageStream('data: {"type":"error","error":{"code":"x","message":"boom"}}\n\n'), /boom/)
  assert.throws(() => parseImageStream(''), /without a completed image/)
})

test('partial_images turns on streaming and is clamped to 0-3', async () => {
  const { buildGenerationBody } = await import('../lib/openai.js')
  const body = buildGenerationBody({ partial_images: 9, safety_identifier: 'u1' }, normalizeConfig({}), 'x')
  assert.equal(body.stream, true)
  assert.equal(body.partial_images, 3)
  assert.equal(body.safety_identifier, 'u1')
  assert.equal('stream' in buildGenerationBody({}, normalizeConfig({}), 'x'), false)
})

test('edit forms carry input_fidelity and background', async () => {
  const { buildEditForm } = await import('../lib/openai.js')
  const form = buildEditForm({ args: { input_fidelity: 'high', background: 'transparent' }, cfg: normalizeConfig({}), prompt: 'x', sources: [{ name: 'a.png', bytes: Buffer.from('a') }], format: 'png' })
  assert.equal(form.get('input_fidelity'), 'high')
  assert.equal(form.get('background'), 'transparent')
  const bad = buildEditForm({ args: { input_fidelity: 'max' }, cfg: normalizeConfig({}), prompt: 'x', sources: [{ name: 'a.png', bytes: Buffer.from('a') }], format: 'png' })
  assert.equal(bad.get('input_fidelity'), null)
})
