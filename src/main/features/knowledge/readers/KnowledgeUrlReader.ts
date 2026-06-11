import type { KnowledgeItemOf } from '@shared/data/types/knowledge'
import type { Document as VectorStoreDocument } from '@vectorstores/core'

import { loadDocumentsFromKnowledgeBaseFile } from './KnowledgeFileReader'

/**
 * Read a URL item from its captured on-disk snapshot — never the network. The
 * indexing job's ensure-snapshot step fetches and persists the snapshot (and
 * its `relativePath`) before this runs, so a missing `relativePath` here is a
 * contract violation, not a "fetch it now" fallback.
 */
export async function loadUrlDocuments(item: KnowledgeItemOf<'url'>): Promise<VectorStoreDocument[]> {
  if (!item.data.relativePath) {
    throw new Error(`Knowledge URL item ${item.id} has no captured snapshot to read`)
  }

  return loadDocumentsFromKnowledgeBaseFile(item.baseId, item.data.relativePath, item.data.source)
}
