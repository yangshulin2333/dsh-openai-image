import assert from 'node:assert/strict'
import test from 'node:test'
import { briefSlug, markdownImagePath, slugify, timestamp } from '../lib/paths.js'
import { imageOutput, uploadOutput } from '../lib/output.js'

test('slugify normalizes to a lower-case dash slug', () => {
  assert.equal(slugify('A Lantern-Lit Bridge!'), 'a-lantern-lit-bridge')
  assert.equal(slugify('***'), 'image')
})

test('briefSlug cuts on a word boundary instead of mid-word', () => {
  const long = 'harness-frame-a-lantern-lit-stone-bridge-over-a-misty-river-side-view'
  const slug = briefSlug(long, 48)
  assert.ok(slug.length <= 48, `${slug} is ${slug.length} chars`)
  assert.ok(!slug.endsWith('-'), `${slug} must not end with a dash`)
  assert.ok(long.startsWith(slug), `${slug} must be a prefix of the full slug`)
})

test('briefSlug keeps short slugs untouched', () => {
  assert.equal(briefSlug('fox knight'), 'fox-knight')
})

test('markdownImagePath uses forward slashes and brackets spaced paths', () => {
  assert.equal(markdownImagePath('D:\\Roblox\\out\\fox.png'), 'D:/Roblox/out/fox.png')
  assert.equal(markdownImagePath('D:\\My Images\\fox (1).png'), '<D:/My Images/fox (1).png>')
})

test('timestamp is a 14-digit UTC stamp', () => {
  assert.match(timestamp(), /^\d{14}$/)
})

test('render returns content blocks, never a bare string', () => {
  for (const output of [imageOutput, uploadOutput]) {
    const blocks = output.render({}, { summary: 'done' })
    assert.ok(Array.isArray(blocks), 'render must return an array of content blocks')
    assert.deepEqual(blocks, [{ type: 'text', text: 'done' }])
    const fallback = output.render({}, {})
    assert.equal(Array.isArray(fallback) && fallback[0].type, 'text')
  }
})

test('output schemas never declare null values', () => {
  for (const output of [imageOutput, uploadOutput]) {
    for (const [key, spec] of Object.entries(output.schema.properties)) {
      assert.notEqual(spec.type, 'null', `${key} must not be null-typed`)
    }
  }
})
