import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASPECT_TO_SIZE,
  assertTransparentCombination,
  buildGenerationBody,
  clampCount,
  describeApiError,
  isRetryableStatus,
  resolveSize,
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

test('count is clamped to 1..4', () => {
  assert.equal(clampCount(0), 1)
  assert.equal(clampCount(9), 4)
  assert.equal(clampCount(undefined), 1)
  assert.equal(clampCount('3'), 3)
})

test('transparent backgrounds need png or webp', () => {
  assert.doesNotThrow(() => assertTransparentCombination('png', 'transparent'))
  assert.throws(() => assertTransparentCombination('jpeg', 'transparent'), /transparent backgrounds require/)
  assert.doesNotThrow(() => assertTransparentCombination('jpeg', 'opaque'))
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
