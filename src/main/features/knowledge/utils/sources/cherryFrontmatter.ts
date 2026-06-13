/**
 * The `cherry`-namespaced frontmatter block on app-written knowledge files
 * (url snapshots today). The block does two jobs: it makes the file
 * self-describing independently of any database row, and it gates the strip
 * below so user-authored frontmatter indexes untouched.
 *
 * Serialize and strip must stay exact inverses: indexing reads the snapshot
 * file and strips this block to recover the canonical `content.text`, so any
 * drift between the two would make every snapshot hash as "modified".
 */

/** `origin` value for snapshots reconstructed from migrated v1 chunks. */
export const CHERRY_SNAPSHOT_ORIGIN_V1_MIGRATION = 'v1-migration'

export interface CherryUrlSnapshotFrontmatter {
  /** The captured page URL. */
  source: string
  /**
   * ISO time the snapshot file was written: the fetch time for a live
   * capture, the migration time for a reconstructed one.
   */
  capturedAt: string
  /**
   * Provenance of a snapshot reconstructed rather than fetched (e.g.
   * 'v1-migration'); absent on live captures. Readers must not treat a
   * reconstructed snapshot's `capturedAt` as a page-fetch time.
   */
  origin?: string
}

/**
 * Render the frontmatter block for a captured URL snapshot, closing-delimiter
 * newline included, so `serialize(fields) + markdown` is the exact file text.
 * Values are JSON-quoted (valid YAML double-quoted scalars), which keeps a
 * value containing `---` or `#` from ever forming a delimiter or comment line.
 */
export function serializeCherryUrlSnapshotFrontmatter(fields: CherryUrlSnapshotFrontmatter): string {
  const lines = [
    '---',
    'cherry:',
    '  type: url-snapshot',
    `  source: ${JSON.stringify(fields.source)}`,
    `  captured_at: ${JSON.stringify(fields.capturedAt)}`
  ]
  if (fields.origin !== undefined) {
    lines.push(`  origin: ${JSON.stringify(fields.origin)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

/**
 * Remove a leading frontmatter block only when it carries a top-level `cherry`
 * key; any other text — including a user file's own frontmatter or a body that
 * merely starts with `---` — passes through byte-for-byte.
 */
export function stripCherryFrontmatter(text: string): string {
  if (!text.startsWith('---\n')) {
    return text
  }
  const closeStart = text.indexOf('\n---\n', 3)
  if (closeStart === -1) {
    return text
  }
  const block = text.slice(4, closeStart + 1)
  if (!/^cherry:/m.test(block)) {
    return text
  }
  return text.slice(closeStart + 5)
}
