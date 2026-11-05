import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  buildCreateAssetRequest,
  describeRobloxError,
  extractOperationId,
  pngDimensions,
  validateRobloxImage,
} from '../lib/roblox.js'

function pngBuffer(width, height, extraBytes = 0) {
  const header = Buffer.alloc(24)
  Buffer.from('\x89PNG\r\n\x1a\n', 'latin1').copy(header, 0)
  header.writeUInt32BE(13, 8)
  Buffer.from('IHDR', 'latin1').copy(header, 12)
  header.writeUInt32BE(width, 16)
  header.writeUInt32BE(height, 20)
  return Buffer.concat([header, Buffer.alloc(extraBytes)])
}

test('pngDimensions reads the IHDR chunk', () => {
  assert.deepEqual(pngDimensions(pngBuffer(1024, 1536)), { width: 1024, height: 1536 })
  assert.equal(pngDimensions(Buffer.from('not a png at all, definitely not')), undefined)
  assert.equal(pngDimensions(Buffer.alloc(4)), undefined)
})

test('validateRobloxImage accepts the documented formats', () => {
  for (const extension of ALLOWED_EXTENSIONS) {
    const result = validateRobloxImage({ bytes: pngBuffer(512, 512), fileName: `art${extension}` })
    assert.equal(result.extension, extension)
  }
})

test('validateRobloxImage rejects unsupported extensions', () => {
  assert.throws(() => validateRobloxImage({ bytes: pngBuffer(10, 10), fileName: 'a.webp' }), /only accepts/)
  assert.throws(() => validateRobloxImage({ bytes: Buffer.alloc(0), fileName: 'a.png' }), /empty/)
})

test('validateRobloxImage rejects oversized files and oversized images', () => {
  const big = Buffer.concat([pngBuffer(256, 256), Buffer.alloc(MAX_UPLOAD_BYTES)])
  assert.throws(() => validateRobloxImage({ bytes: big, fileName: 'big.png' }), /20 MB/)
  assert.throws(() => validateRobloxImage({ bytes: pngBuffer(8000, 100, 0), fileName: 'wide.png' }), /8000x8000/)
})

test('buildCreateAssetRequest builds a personal creator context', () => {
  const request = buildCreateAssetRequest({ displayName: 'Fox icon', creatorId: '1234' })
  assert.deepEqual(request, {
    assetType: 'Decal',
    displayName: 'Fox icon',
    description: '',
    creationContext: { creator: { userId: '1234' } },
  })
})

test('buildCreateAssetRequest supports group creators and Image assets', () => {
  const request = buildCreateAssetRequest({
    assetType: 'Image',
    displayName: 'UI panel',
    creatorType: 'group',
    creatorId: '987',
  })
  assert.equal(request.assetType, 'Image')
  assert.deepEqual(request.creationContext, { creator: { groupId: '987' } })
})

test('buildCreateAssetRequest validates its inputs', () => {
  assert.throws(() => buildCreateAssetRequest({ displayName: 'x', creatorId: '' }), /robloxCreatorId is empty/)
  assert.throws(() => buildCreateAssetRequest({ displayName: '', creatorId: '1' }), /display_name is required/)
  assert.throws(
    () => buildCreateAssetRequest({ displayName: 'x'.repeat(51), creatorId: '1' }),
    /50 characters or fewer/,
  )
  assert.throws(() => buildCreateAssetRequest({ displayName: 'x', creatorId: '1', assetType: 'Model' }), /not supported/)
})

test('extractOperationId accepts the documented shapes', () => {
  assert.equal(extractOperationId({ path: 'operations/abc-123' }), 'abc-123')
  assert.equal(extractOperationId({ path: 'v1/operations/abc-123' }), 'abc-123')
  assert.equal(extractOperationId({ operationId: 'xyz' }), 'xyz')
  assert.equal(extractOperationId({}), undefined)
})

test('describeRobloxError explains auth and permission failures', () => {
  assert.match(describeRobloxError(401, { message: 'Unauthorized' }), /"assets" scope/)
  assert.match(describeRobloxError(403, { message: 'Forbidden' }), /creator id/)
  assert.match(describeRobloxError(429, {}), /rate-limited/)
  assert.match(describeRobloxError(400, { errors: [{ message: 'bad asset' }] }), /bad asset/)
})
