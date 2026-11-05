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
  }
  apply(ctx, initial)
  return { tools, listeners, tool: (name) => tools.find((item) => item.name === name) }
}

test('a config edit reaches the running plugin without a remount', async () => {
  const host = fakeHost({ robloxEnabled: true, robloxCreatorId: '1', outputDir: 'generated-images' })
  const upload = host.tool('roblox_upload')
  assert.ok(upload, 'roblox_upload should be registered')

  // The config editor runs this waterfall before reconciling, so the plugin
  // must fold the next raw config into the object its tools already read.
  const listener = host.listeners.find((entry) => entry.name === 'internal/config')
  assert.ok(listener, 'the plugin must listen for internal/config')
  listener.fn({ robloxEnabled: false, robloxCreatorId: '1', outputDir: 'generated-images' })

  await assert.rejects(
    () => upload.execute({ image: 'missing.png', display_name: 'probe' }, { agent: { session: { header: { cwd: process.cwd() } } } }),
    /switched off/,
  )
})
