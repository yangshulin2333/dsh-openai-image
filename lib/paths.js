import path from 'node:path'
import { existsSync } from 'node:fs'

export function cwdOf(exec) {
  const fromExec = exec?.agent?.session?.header?.cwd
  if (typeof fromExec === 'string' && fromExec.trim()) return fromExec
  return process.cwd()
}

export function resolveUserPath(value, cwd) {
  const raw = String(value ?? '').trim()
  if (!raw) return cwd
  const expanded = raw.startsWith('~')
    ? path.join(process.env.USERPROFILE || process.env.HOME || cwd, raw.slice(1))
    : raw
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(cwd, expanded)
}

export function slugify(value, fallback = 'image') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

/** Slug shortened on a word boundary so file names never end mid-word. */
export function briefSlug(value, max = 48) {
  const slug = slugify(value)
  if (slug.length <= max) return slug
  const cut = slug.slice(0, max)
  const boundary = cut.lastIndexOf('-')
  return (boundary > 12 ? cut.slice(0, boundary) : cut).replace(/-+$/, '') || slug.slice(0, max)
}

/** Markdown-safe image target: forward slashes, angle brackets when needed. */
export function markdownImagePath(absolute) {
  const normalized = String(absolute).replace(/\\/g, '/')
  return /[\s()<>]/.test(normalized) ? `<${normalized}>` : normalized
}

export function mimeOf(fileName) {
  const extension = path.extname(String(fileName)).toLowerCase()
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.bmp') return 'image/bmp'
  if (extension === '.tga') return 'image/tga'
  if (extension === '.gif') return 'image/gif'
  return 'image/png'
}

export function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

export function assertFileExists(absolute, label) {
  if (!existsSync(absolute)) throw new Error(`${label} not found: ${absolute}`)
  return absolute
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
