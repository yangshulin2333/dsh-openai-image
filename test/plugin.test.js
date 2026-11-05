import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

function fakeHost(initial) {
  const tools = []
  const listeners = []
  const ctx = {
    tools: { register: (tool) => (tools.push(tool), { dispose() {} }) },
    effect: (fn) => fn(),
    inject: () => {},
    on: (name, fn) => listeners.push({ name, fn }),
    get: () => undefined,
    logger: { info() {} },
    fiber: { name: 'self' },
  }
  apply(ctx, initial)
  return { ctx, tools, listeners, tool: (name) => tools.find((item) => item.name === name) }
}

test('a config edit reaches the running plugin without a remount', async () => {
  const host = fakeHost({ robloxEnabled: true, robloxCreatorId: '1', outputDir: 'generated-images' })
  const upload = host.tool('roblox_upload')
  assert.ok(upload, 'roblox_upload should be registered')

  // The config editor runs this waterfall before reconciling, so the plugin
  // must fold the next raw config into the object its tools already read.
  const listener = host.listeners.find((entry) => entry.name === 'internal/config')
  assert.ok(listener, 'the plugin must listen for internal/config')
  const next = { robloxEnabled: false, robloxCreatorId: '1', outputDir: 'generated-images' }
  listener.fn.call(host.ctx.fiber, next, () => next)

  await assert.rejects(
    () => upload.execute({ image: 'missing.png', display_name: 'probe' }, { agent: { session: { header: { cwd: process.cwd() } } } }),
    /switched off/,
  )
})

test('internal/config for another plugin passes through untouched', () => {
  const host = fakeHost({ outputFormat: 'gif' })
  const listener = host.listeners.find((entry) => entry.name === 'internal/config')
  const other = { thresholdChars: 1000 }
  const result = listener.fn.call({ name: 'tool-result-pruner' }, other, () => other)
  assert.deepEqual(result, { thresholdChars: 1000 })
})

test('image_edit falls back to png when the configured default is svg', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-openai-image-edit-'))
  process.env.DSH_OPENAI_IMAGE_EDIT_KEY = 'sk-test'
  const original = globalThis.fetch
  let sentFormat
  globalThis.fetch = async (_url, init) => {
    sentFormat = init.body.get('output_format')
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }), { status: 200 })
  }
  try {
    await writeFile(path.join(dir, 'src.png'), Buffer.from('x'))
    const host = fakeHost({ outputFormat: 'svg', apiKeyEnv: 'DSH_OPENAI_IMAGE_EDIT_KEY', outputDir: 'out' })
    const result = await host.tool('image_edit').execute(
      { prompt: 'make it blue', image: 'src.png' },
      { agent: { session: { header: { cwd: dir } } } },
    )
    assert.equal(sentFormat, 'png')
    assert.match(result.path, /\.png$/)
    await assert.rejects(
      () => host.tool('image_edit').execute({ prompt: 'x', image: 'src.png', output_format: 'svg' }, { agent: { session: { header: { cwd: dir } } } }),
      /cannot produce svg|output_format/,
    )
  } finally {
    globalThis.fetch = original
    await rm(dir, { recursive: true, force: true })
  }
})
