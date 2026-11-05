import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASPECT_TO_SIZE,
  assertMaskHasAlpha,
  assertTransparentCombination,
  buildEditForm,
  buildGenerationBody,
  clampCount,
  clampFrameCount,
  describeApiError,
  isRetryableStatus,
  resolveGifSize,
  resolveSize,
  retimeGif,
  validateSize,
} from '../lib/openai.js'

test('request body only carries documented Images API fields', () => {
  const body = buildGenerationBody(
    { prompt: 'x', seed: 42, steps: 30, negative_prompt: 'blur', guidance_scale: 7 },
    { model: 'gpt-image-2.6-flare', size: '1024x1024', quality: 'auto', outputFormat: 'png' },
    'a castle',
  )
  assert.deepEqual(Object.keys(body).sort(), ['model', 'n', 'output_format', 'prompt', 'size'].sort())
  assert.equal(body.seed, undefined)
  assert.equal(body.steps, undefined)
  assert.equal(body.negative_prompt, undefined)
  assert.equal(body.guidance_scale, undefined)
  assert.equal(body.prompt, 'a castle')
})

test('quality auto is omitted so the API default applies', () => {
  const body = buildGenerationBody({}, { model: 'm', quality: 'auto' }, 'p')
  assert.equal(body.quality, undefined)
  const explicit = buildGenerationBody({ quality: 'high' }, { model: 'm', quality: 'auto' }, 'p')
  assert.equal(explicit.quality, 'high')
})

test('size auto is omitted', () => {
  const body = buildGenerationBody({}, { model: 'm', size: 'auto' }, 'p')
  assert.equal(body.size, undefined)
})

test('aspect_ratio maps to the nearest supported size', () => {
  assert.equal(resolveSize({ aspect_ratio: '1:1' }), '1024x1024')
  assert.equal(resolveSize({ aspect_ratio: '16:9' }), '1536x1024')
  assert.equal(resolveSize({ aspect_ratio: '9:16' }), '1024x1536')
  assert.equal(resolveSize({ aspect_ratio: '1:1', size: '1536x1024' }), '1024x1024')
  for (const size of Object.values(ASPECT_TO_SIZE)) {
    assert.ok(['1024x1024', '1536x1024', '1024x1536'].includes(size))
  }
})

test('count is clamped to 1..10', () => {
  assert.equal(clampCount(0), 1)
  assert.equal(clampCount(9), 9)
  assert.equal(clampCount(99), 10)
  assert.equal(clampCount(undefined), 1)
  assert.equal(clampCount('3'), 3)
})

test('transparent backgrounds need png or webp', () => {
  assert.doesNotThrow(() => assertTransparentCombination('png', 'transparent'))
  assert.throws(() => assertTransparentCombination('jpeg', 'transparent'), /transparent backgrounds require/)
  assert.doesNotThrow(() => assertTransparentCombination('jpeg', 'opaque'))
})

test('gif bodies carry frame_count and stay inside the sprite-sheet budget', () => {
  const body = buildGenerationBody(
    { output_format: 'gif', frame_count: 6 },
    { model: 'gpt-image-2.6-flare', size: '1024x1024', quality: 'auto', outputFormat: 'png' },
    'a bouncing ball',
  )
  assert.equal(body.output_format, 'gif')
  assert.equal(body.frame_count, 6)
  assert.equal(body.size, '512x512')
  assert.equal(body.quality, undefined)
  assert.equal(body.svg, undefined)
  // an oversized requested size must fall back, never reach the API
  assert.equal(resolveGifSize({ size: '1536x1024' }), '512x512')
  assert.equal(resolveGifSize({ size: '256x256' }), '256x256')
  assert.equal(clampFrameCount(99), 16)
  assert.equal(clampFrameCount(1), 2)
  assert.equal(clampFrameCount(undefined), 6)
})

test('svg bodies hand the drawing to a text model and drop raster knobs', () => {
  const body = buildGenerationBody(
    { output_format: 'svg', svg_model: 'gpt-6-astra', quality: 'high', aspect_ratio: '16:9' },
    { model: 'gpt-image-2.6-flare', outputFormat: 'png', svgModel: 'gpt-6.1-sol' },
    'a flat fox icon',
  )
  assert.deepEqual(body.svg, { model: 'gpt-6-astra' })
  assert.equal(body.output_format, 'svg')
  assert.equal(body.size, undefined)
  assert.equal(body.quality, undefined)
  assert.equal(body.frame_count, undefined)
  const fallback = buildGenerationBody({ output_format: 'svg' }, { svgModel: 'gpt-6.1-sol' }, 'p')
  assert.deepEqual(fallback.svg, { model: 'gpt-6.1-sol' })
})

test('api errors keep the provider code', () => {
  const message = describeApiError(400, { error: { message: 'Unknown parameter: seed', code: 'unknown_parameter' } })
  assert.match(message, /HTTP 400/)
  assert.match(message, /code=unknown_parameter/)
  assert.match(message, /Unknown parameter/)
})

test('retryable statuses', () => {
  assert.equal(isRetryableStatus(429), true)
  assert.equal(isRetryableStatus(500), true)
  assert.equal(isRetryableStatus(400), false)
  assert.equal(isRetryableStatus(401), false)
})

test('arbitrary sizes are validated the way the API validates them', () => {
  assert.equal(validateSize('1824x1024'), '1824x1024')
  assert.equal(resolveSize({ size: '2048x2048' }), '2048x2048')
  assert.throws(() => validateSize('1000x1000'), /divisible by 16/)
  assert.throws(() => validateSize('4096x4096'), /at most 3840/)
  assert.throws(() => validateSize('wide'), /WIDTHxHEIGHT|must look like/)
  assert.equal(resolveSize({ size: 'auto' }, { size: '1024x1024' }), '1024x1024')
})

test('moderation and compression only travel when they are meaningful', () => {
  const plain = buildGenerationBody({}, { model: 'm', moderation: 'auto', outputCompression: 0 }, 'p')
  assert.equal(plain.moderation, undefined)
  assert.equal(plain.output_compression, undefined)
  const tuned = buildGenerationBody(
    { moderation: 'low', output_compression: 70, user: 'u1' },
    { model: 'm', outputFormat: 'webp' },
    'p',
  )
  assert.equal(tuned.moderation, 'low')
  assert.equal(tuned.output_compression, 70)
  assert.equal(tuned.user, 'u1')
  const png = buildGenerationBody(
    { output_compression: 70 },
    { model: 'm', outputFormat: 'png' },
    'p',
  )
  assert.equal(png.output_compression, undefined)
})

test('edit forms use image[] for several inputs and carry gif knobs', () => {
  const sources = [
    { name: 'a.png', bytes: Buffer.from('a') },
    { name: 'b.png', bytes: Buffer.from('b') },
  ]
  const form = buildEditForm({
    args: { count: 2, moderation: 'low' },
    cfg: { model: 'gpt-image-2.6-flare', quality: 'auto' },
    prompt: 'animate this',
    sources,
    format: 'gif',
  })
  assert.equal(form.getAll('image[]').length, 2)
  assert.equal(form.getAll('image').length, 0)
  assert.equal(form.get('output_format'), 'gif')
  assert.equal(form.get('frame_count'), '6')
  assert.equal(form.get('size'), '512x512')
  assert.equal(form.get('moderation'), 'low')
  assert.equal(form.get('n'), '2')

  const single = buildEditForm({
    args: {},
    cfg: { model: 'm' },
    prompt: 'x',
    sources: [sources[0]],
    format: 'png',
  })
  assert.equal(single.getAll('image').length, 1)
  assert.equal(single.getAll('image[]').length, 0)
})

test('gif retiming patches every graphic control extension', () => {
  const frame = Buffer.from([0x21, 0xf9, 0x04, 0x00, 0x14, 0x00, 0x00, 0x00])
  const gif = Buffer.concat([Buffer.from('GIF89a'), frame, Buffer.from('data'), frame])
  const retimed = retimeGif(gif, 12)
  assert.equal(retimed.subarray(0, 6).toString('latin1'), 'GIF89a')
  // first GCE starts at 6, so its 16-bit delay sits at 6 + 4
  assert.equal(retimed.readUInt16LE(10), 8)
  // second GCE starts at 6 + 8 + 4
  assert.equal(retimed.readUInt16LE(22), 8)
  assert.equal(retimeGif(Buffer.from('not a gif'), 12).toString(), 'not a gif')
  assert.equal(retimeGif(gif, 0), gif)
})

test('masks must be RGBA png', () => {
  const png = Buffer.alloc(32)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0)
  png[25] = 6
  assert.doesNotThrow(() => assertMaskHasAlpha(png))
  const rgb = Buffer.from(png)
  rgb[25] = 2
  assert.throws(() => assertMaskHasAlpha(rgb), /no alpha channel/)
  assert.throws(() => assertMaskHasAlpha(Buffer.from('jpeg bytes here')), /must be a PNG/)
})
