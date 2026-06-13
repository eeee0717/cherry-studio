import { sanitizeFilename } from '@shared/file/types/filename'

import { reserveImportedFileRelativePath, writeFileIntoKnowledgeBaseAt } from '../storage/pathStorage'
import { serializeCherryUrlSnapshotFrontmatter } from './cherryFrontmatter'

const SNAPSHOT_TITLE_MAX = 80

/**
 * Derive a human-readable file stem for a captured URL snapshot: the page's
 * first markdown heading (or first non-empty line), falling back to a slug of
 * the URL host and last path segment, and finally to `page`.
 */
export function deriveUrlSnapshotSlug(markdown: string, url: string): string {
  const fromMarkdown = sanitizeFilename(firstHeadingOrLine(markdown).slice(0, SNAPSHOT_TITLE_MAX).trim())
  if (fromMarkdown && fromMarkdown !== 'untitled') {
    return fromMarkdown
  }
  const fromUrl = sanitizeFilename(urlStem(url).slice(0, SNAPSHOT_TITLE_MAX).trim())
  if (fromUrl && fromUrl !== 'untitled') {
    return fromUrl
  }
  return 'page'
}

function firstHeadingOrLine(markdown: string): string {
  const lines = markdown.split('\n').map((line) => line.trim())
  const heading = lines.find((line) => /^#{1,6}\s+/.test(line))
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, '')
  }
  return lines.find(Boolean) ?? ''
}

function urlStem(url: string): string {
  try {
    const parsed = new URL(url)
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop()
    return [parsed.hostname, lastSegment].filter(Boolean).join('-')
  } catch {
    return ''
  }
}

/**
 * Write a captured URL snapshot into the base under a collision-free, readable
 * name and return its base-relative path. `reservedPaths` is the set of names
 * already occupied in the base; callers build it and call this under the base
 * mutation lock so two concurrent captures cannot pick the same path.
 *
 * The file is the markdown prefixed with the `cherry` frontmatter block, which
 * records the source URL on the file itself (knowledge_item exit path,
 * knowledge-technical-design.md §7); reading for indexing strips it back off.
 */
export async function captureUrlSnapshotFile(
  baseId: string,
  url: string,
  markdown: string,
  reservedPaths: Set<string>
): Promise<string> {
  const relativePath = reserveImportedFileRelativePath(
    `${deriveUrlSnapshotSlug(markdown, url)}.md`,
    false,
    reservedPaths
  )
  const frontmatter = serializeCherryUrlSnapshotFrontmatter({
    source: url,
    capturedAt: new Date().toISOString()
  })
  return await writeFileIntoKnowledgeBaseAt(baseId, relativePath, frontmatter + markdown)
}
