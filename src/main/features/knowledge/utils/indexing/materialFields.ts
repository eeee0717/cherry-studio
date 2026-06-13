import type { KnowledgeItemOf } from '@shared/data/types/knowledge'

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
