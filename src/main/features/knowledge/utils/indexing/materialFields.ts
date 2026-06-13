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

/**
 * A material's stable relative path. A file uses its stored path (the processed
 * artifact when present). A url uses its captured snapshot path once it has one —
 * the snapshot is a real base file under `raw/` — and only falls back to the item
 * id while no snapshot exists yet. A note has no base file, so it uses the item id.
 */
export function toMaterialRelativePath(item: MaterialFieldSource): string {
  if (item.type === 'file') {
    return item.data.indexedRelativePath ?? item.data.relativePath
  }
  if (item.type === 'url') {
    return item.data.relativePath ?? item.id
  }
  return item.id
}
