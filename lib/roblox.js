// Roblox Open Cloud asset upload.
//
// Endpoint facts (docs: cloud/guides/usage-assets):
//   POST https://apis.roblox.com/assets/v1/assets      multipart: request + fileContent
//   GET  https://apis.roblox.com/assets/v1/operations/{id}   poll until done
//   Decal/Image: png | jpeg | bmp | tga, < 8000x8000 px, <= 20 MB, NOT updatable
// Every upload needs an API key with the `assets` scope (read + write) and a
// creator context (personal userId or groupId).

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { mimeOf } from './paths.js'
import { resolveCredential } from './openai.js'
import { sleep } from './paths.js'

export const ROBLOX_API_BASE = 'https://apis.roblox.com'
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MAX_DIMENSION = 8000
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.tga']
export const ASSET_TYPES = ['Decal', 'Image']

export function pngDimensions(buffer) {
  if (!buffer || buffer.length < 24) return undefined
  const signature = buffer.subarray(0, 8).toString('latin1')
  if (signature !== '\x89PNG\r\n\x1a\n') return undefined
  if (buffer.subarray(12, 16).toString('latin1') !== 'IHDR') return undefined
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

export function validateRobloxImage({ bytes, fileName }) {
  const extension = path.extname(String(fileName || '')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Roblox only accepts ${ALLOWED_EXTENSIONS.join(', ')} for image assets (got "${extension || 'no extension'}"). ` +
        'Re-run the generation with output_format png or jpeg.',
    )
  }
  if (!bytes || bytes.length === 0) throw new Error(`Image is empty: ${fileName}`)
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Roblox rejects assets larger than 20 MB (got ${(bytes.length / 1024 / 1024).toFixed(2)} MB). ` +
        'Regenerate at a smaller size or recompress.',
    )
  }
  const dimensions = pngDimensions(bytes)
  if (dimensions && (dimensions.width >= MAX_DIMENSION || dimensions.height >= MAX_DIMENSION)) {
    throw new Error(
      `Roblox rejects images at or above ${MAX_DIMENSION}x${MAX_DIMENSION} (got ${dimensions.width}x${dimensions.height}).`,
    )
  }
  return { extension, dimensions, bytes: bytes.length }
}

export function buildCreateAssetRequest({ assetType = 'Decal', displayName, description = '', creatorType = 'user', creatorId }) {
  if (!ASSET_TYPES.includes(assetType)) {
    throw new Error(`asset not supported: "${assetType}" (expected ${ASSET_TYPES.join(' or ')})`)
  }
  const name = String(displayName || '').trim()
  if (!name) throw new Error('display_name is required for a Roblox upload')
  if (name.length > 50) throw new Error('display_name must be 50 characters or fewer')
  const id = String(creatorId ?? '').trim()
  if (!id) {
    throw new Error(
      'robloxCreatorId is empty. Set it to your Roblox user id (https://www.roblox.com/users/<id>/profile) ' +
        'or a group id, in the plugin settings.',
    )
  }
  const creator = creatorType === 'group' ? { groupId: id } : { userId: id }
  return {
    assetType,
    displayName: name,
    description: String(description || '').slice(0, 1000),
    creationContext: { creator },
  }
}

export function extractOperationId(payload) {
  const raw = payload?.path || payload?.operationId || payload?.name || ''
  const match = String(raw).match(/operations\/([^/?#]+)/)
  if (match) return match[1]
  return raw ? String(raw).replace(/^.*\//, '') : undefined
}

export function describeRobloxError(status, payload) {
  const message =
    payload?.message ||
    payload?.error?.message ||
    payload?.errors?.[0]?.message ||
    payload?.raw ||
    `HTTP ${status}`
  const hint =
    status === 401
      ? ' Check that ROBLOX_API_KEY holds an Open Cloud API key with the "assets" scope.'
      : status === 403
        ? ' The API key is valid but lacks asset read/write permission, or the creator id is not yours.'
        : status === 429
          ? ' Roblox rate-limited the upload; wait a moment and retry.'
          : ''
  return `Roblox asset upload failed (HTTP ${status}): ${message}${hint}`
}

export async function uploadAsset(ctx, cfg, options) {
  const {
    filePath,
    displayName,
    description,
    assetType = cfg.robloxAssetType || 'Decal',
    creatorType = cfg.robloxCreatorType || 'user',
    creatorId = cfg.robloxCreatorId,
    log = () => {},
    pollTimeoutMs = 120000,
  } = options

  const bytes = await readFile(filePath)
  const checked = validateRobloxImage({ bytes, fileName: filePath })
  const request = buildCreateAssetRequest({ assetType, displayName, description, creatorType, creatorId })

  const key = await resolveCredential(ctx, cfg.robloxApiKeyEnv, 'Roblox Open Cloud API key')
  const form = new FormData()
  form.append('request', JSON.stringify(request))
  form.append('fileContent', new Blob([bytes], { type: mimeOf(filePath) }), path.basename(filePath))

  const url = `${ROBLOX_API_BASE}/assets/v1/assets`
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: form,
      signal: AbortSignal.timeout(120000),
    })
  } catch (error) {
    throw new Error(`Roblox asset upload failed (network): ${error?.message || error}`)
  }
  const text = await response.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text.slice(0, 800) }
  }
  if (!response.ok) throw new Error(describeRobloxError(response.status, payload))

  const operationId = extractOperationId(payload)
  if (!operationId) throw new Error(`Roblox did not return an operation id: ${text.slice(0, 400)}`)
  log(`dsh-openai-image: Roblox upload accepted, operation ${operationId}`)

  const started = Date.now()
  let operation
  let pollFailures = 0
  while (Date.now() - started < pollTimeoutMs) {
    await sleep(1500)
    // The asset already exists once the POST was accepted, so a transient
    // network blip while polling must not turn into "upload failed" (which
    // invites a duplicate upload). Tolerate a few in a row.
    let poll
    let pollText
    try {
      poll = await fetch(`${ROBLOX_API_BASE}/assets/v1/operations/${operationId}`, {
        method: 'GET',
        headers: { 'x-api-key': key },
        signal: AbortSignal.timeout(30000),
      })
      pollText = await poll.text()
    } catch (error) {
      pollFailures += 1
      if (pollFailures >= 4) {
        throw new Error(
          `Roblox accepted the upload (operation ${operationId}) but polling kept failing: ${error?.message || error}. ` +
            'Check the Creator Dashboard before retrying, the asset probably exists.',
        )
      }
      log(`dsh-openai-image: Roblox poll failed (${pollFailures}/3), retrying: ${error?.message || error}`)
      continue
    }
    pollFailures = 0
    if (poll.status === 429 || poll.status >= 500) continue
    let pollPayload
    try {
      pollPayload = pollText ? JSON.parse(pollText) : {}
    } catch {
      pollPayload = { raw: pollText.slice(0, 800) }
    }
    if (!poll.ok) throw new Error(describeRobloxError(poll.status, pollPayload))
    operation = pollPayload
    if (operation?.done === true) break
  }
  if (!operation || operation.done !== true) {
    throw new Error(
      `Roblox upload timed out after ${pollTimeoutMs}ms (operation ${operationId}). ` +
        'The asset may still finish on Roblox; check the Creator Dashboard before retrying.',
    )
  }

  const asset = operation.response || {}
  const assetId = asset.assetId || asset.id
  if (!assetId) {
    throw new Error(
      `Roblox operation ${operationId} finished without an asset id: ${JSON.stringify(operation).slice(0, 500)}`,
    )
  }
  return {
    operationId,
    assetId: String(assetId),
    rbxassetid: `rbxassetid://${assetId}`,
    assetType: asset.assetType || assetType,
    moderationState: asset.moderationResult?.moderationState || 'UNKNOWN',
    displayName: asset.displayName || displayName,
    durationMs: Date.now() - started,
    dimensions: checked.dimensions,
    bytes: checked.bytes,
  }
}
