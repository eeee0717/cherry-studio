import { getFileExt } from '@main/utils/file'
import type { KnowledgeItemOf } from '@shared/data/types/knowledge'

import type { ContentTextFormat, MaterialOrigin } from '../../vectorstore/indexStore/model'

/**
 * The subset of an indexable knowledge item needed to derive its index-store
 * material fields. The `Pick` is distributed per member so `type` and `data`
 * stay correlated (a single `Pick` over the union would collapse `data` to a bare
 * union and lose the file-only `relativePath` / `indexedRelativePath`). Shared by
 * the indexing job and the v1→v2 vector migrator so both stamp the material
 * identically (knowledge-technical-design.md §4.2).
 */
export type MaterialFieldSource =
  | Pick<KnowledgeItemOf<'file'>, 'id' | 'type' | 'data'>
  | Pick<KnowledgeItemOf<'url'>, 'id' | 'type' | 'data'>
  | Pick<KnowledgeItemOf<'note'>, 'id' | 'type' | 'data'>

/** A material's stable relative path: the file's path for files, else the item id (notes/URLs have no file). */
export function toMaterialRelativePath(item: MaterialFieldSource): string {
  if (item.type === 'file') {
    return item.data.indexedRelativePath ?? item.data.relativePath
  }
  return item.id
}

/**
 * Material provenance (the index store's `origin` enum). A file indexed through a
 * processor artifact — MinerU Markdown, addressed by `indexedRelativePath` — is a
 * 'processor' product; a file indexed directly is user-supplied; url/note are
 * 'captured' snapshots.
 */
export function toMaterialOrigin(item: MaterialFieldSource): MaterialOrigin {
  if (item.type !== 'file') {
    return 'captured'
  }
  return item.data.indexedRelativePath ? 'processor' : 'user'
}

/**
 * Format of the content that is actually indexed. The reader resolves a file to
 * `indexedRelativePath ?? relativePath`, so a `.md` there (a processor's Markdown
 * output or a Markdown upload) is 'markdown'; any other file is reader-extracted
 * text; url/note snapshots are Markdown.
 */
export function toContentTextFormat(item: MaterialFieldSource): ContentTextFormat {
  if (item.type !== 'file') {
    return 'markdown'
  }
  const indexedPath = item.data.indexedRelativePath ?? item.data.relativePath
  return getFileExt(indexedPath).toLowerCase() === '.md' ? 'markdown' : 'extracted_text'
}

/**
 * Lower-cased extension of the indexed file (including the dot, e.g. `.pdf`), or
 * undefined for url/note materials whose relative path is a virtual id, not a file.
 */
export function toMaterialFileExt(item: MaterialFieldSource): string | undefined {
  if (item.type !== 'file') {
    return undefined
  }
  const indexedPath = item.data.indexedRelativePath ?? item.data.relativePath
  return getFileExt(indexedPath).toLowerCase() || undefined
}
