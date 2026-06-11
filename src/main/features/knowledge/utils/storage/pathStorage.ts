import fs from 'node:fs/promises'
import path from 'node:path'

import { application } from '@application'
import { loggerService } from '@logger'
import { copy, ensureDir, remove, removeDir, write } from '@main/utils/file/fs'
import type { FilePath } from '@shared/file/types'

const logger = loggerService.withContext('Knowledge:PathStorage')

const CHERRY_META_DIR = '.cherry'
const VECTOR_STORE_FILE = 'index.sqlite'

export function getKnowledgeBaseDir(baseId: string): FilePath {
  return path.join(application.getPath('feature.knowledgebase.data'), baseId) as FilePath
}

export function getKnowledgeBaseMetaDir(baseId: string): FilePath {
  return path.join(getKnowledgeBaseDir(baseId), CHERRY_META_DIR) as FilePath
}

export async function getKnowledgeVectorStoreFilePath(baseId: string): Promise<FilePath> {
  const metaDir = getKnowledgeBaseMetaDir(baseId)
  await ensureDir(metaDir)
  return getKnowledgeVectorStoreFilePathSync(baseId)
}

export function getKnowledgeVectorStoreFilePathSync(baseId: string): FilePath {
  const metaDir = getKnowledgeBaseMetaDir(baseId)
  return path.join(metaDir, VECTOR_STORE_FILE) as FilePath
}

export function getKnowledgeBaseFilePath(baseId: string, relativePath: string): FilePath {
  assertSafeKnowledgeRelativePath(relativePath)
  return path.join(getKnowledgeBaseDir(baseId), relativePath) as FilePath
}

export function getKnowledgeSourceRelativePath(sourcePath: string): string {
  const fileName = path.basename(sourcePath)
  assertSafeKnowledgeRelativePath(fileName)
  return fileName
}

export function toKnowledgeRelativePath(baseId: string, absolutePath: string): string {
  const baseDir = getKnowledgeBaseDir(baseId)
  const relativePath = path.relative(baseDir, absolutePath)
  assertSafeKnowledgeRelativePath(relativePath)
  if (!isPathInsideBase(baseDir, absolutePath)) {
    throw new Error(`Path is outside knowledge base '${baseId}': ${absolutePath}`)
  }
  return normalizeRelativePath(relativePath)
}

export function getProcessedMarkdownRelativePath(relativePath: string): string {
  assertSafeKnowledgeRelativePath(relativePath)
  const parsed = path.parse(relativePath)
  return normalizeRelativePath(path.join(parsed.dir, `${parsed.name}.md`))
}

/** Insert a numeric suffix before the extension: `foo.pdf` + 2 → `foo-2.pdf`. */
export function withRelativePathSuffix(name: string, suffix: number): string {
  const ext = path.extname(name)
  const stem = name.slice(0, name.length - ext.length)
  return `${stem}-${suffix}${ext}`
}

/**
 * Make `name` unique within `used`, inserting a numeric suffix before the
 * extension on collision (`foo.pdf` → `foo-1.pdf` → `foo-2.pdf`). The chosen
 * name is added to `used`. Shared by the v1→v2 migrator and the add workflow so
 * both deduplicate uploaded file names the same way.
 */
export function dedupeKnowledgeRelativePath(name: string, used: Set<string>): string {
  let candidate = name
  let suffix = 1
  while (used.has(candidate)) {
    candidate = withRelativePathSuffix(name, suffix)
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

/**
 * Pick a collision-free relative path for an uploaded file, renaming with a
 * numeric suffix until neither the file path nor — when `withProcessedArtifact`
 * is set — its derived `<name>.md` processing artifact is already reserved. The
 * source name and the artifact are renamed together because a processor always
 * writes the artifact next to its source stem (`brief.docx` → `brief.md`), so
 * the artifact cannot be renamed independently. Reserves the chosen path (and
 * artifact) in `reserved` and returns the file's relative path.
 */
export function reserveUploadedFileRelativePath(
  reserved: Set<string>,
  fileName: string,
  withProcessedArtifact: boolean
): string {
  for (let suffix = 0; ; suffix += 1) {
    const candidate = suffix === 0 ? fileName : withRelativePathSuffix(fileName, suffix)
    const artifact = withProcessedArtifact ? getProcessedMarkdownRelativePath(candidate) : null
    if (!reserved.has(candidate) && !(artifact !== null && reserved.has(artifact))) {
      reserved.add(candidate)
      if (artifact !== null) {
        reserved.add(artifact)
      }
      return candidate
    }
  }
}

export async function copyFileIntoKnowledgeBaseAt(
  baseId: string,
  sourcePath: string,
  relativePath: string
): Promise<string> {
  const destPath = getKnowledgeBaseFilePath(baseId, relativePath)
  await assertTargetAvailable(destPath)
  await ensureDir(path.dirname(destPath) as FilePath)
  await copy(sourcePath as FilePath, destPath)
  return relativePath
}

/** Write in-memory content (e.g. a captured URL snapshot) to a base-relative file. */
export async function writeFileIntoKnowledgeBaseAt(
  baseId: string,
  relativePath: string,
  content: string
): Promise<string> {
  const destPath = getKnowledgeBaseFilePath(baseId, relativePath)
  await assertTargetAvailable(destPath)
  await ensureDir(path.dirname(destPath) as FilePath)
  await write(destPath, content)
  return relativePath
}

/**
 * Collect the base-relative paths already occupied by an item set — every file's
 * source and indexed-artifact path, and every captured URL snapshot path. Used to
 * pick a non-colliding name for a new snapshot.
 */
export function collectKnowledgeReservedRelativePaths(items: Array<{ type: string; data: unknown }>): Set<string> {
  const reserved = new Set<string>()
  for (const item of items) {
    if (typeof item.data !== 'object' || item.data === null) {
      continue
    }
    const data = item.data as { relativePath?: unknown; indexedRelativePath?: unknown }
    if (typeof data.relativePath === 'string') reserved.add(data.relativePath)
    if (typeof data.indexedRelativePath === 'string') reserved.add(data.indexedRelativePath)
  }
  return reserved
}

export async function assertKnowledgeFileTargetAvailable(baseId: string, relativePath: string): Promise<void> {
  await assertTargetAvailable(getKnowledgeBaseFilePath(baseId, relativePath))
}

export async function deleteKnowledgeItemFiles(
  baseId: string,
  items: Array<{ type: string; data: unknown }>
): Promise<void> {
  const paths = new Set<string>()
  for (const item of items) {
    if (item.type !== 'file' || typeof item.data !== 'object' || item.data === null) {
      continue
    }
    const data = item.data as { relativePath?: unknown; indexedRelativePath?: unknown }
    if (typeof data.relativePath === 'string') paths.add(data.relativePath)
    if (typeof data.indexedRelativePath === 'string') paths.add(data.indexedRelativePath)
  }

  await Promise.all([...paths].map((relativePath) => remove(getKnowledgeBaseFilePath(baseId, relativePath))))
}

/**
 * Best-effort variant of {@link deleteKnowledgeItemFiles}: a failed delete
 * (EACCES/EBUSY/... or a reserved/unsafe relativePath) is logged and swallowed
 * so it cannot abort the caller's primary operation (e.g. the subsequent DB row
 * deletion). Orphaned on-disk files are recoverable via full-base deletion;
 * a half-finished DB mutation is not.
 */
export async function deleteKnowledgeItemFilesBestEffort(
  baseId: string,
  items: Array<{ type: string; data: unknown }>,
  logContext: Record<string, unknown>
): Promise<void> {
  try {
    await deleteKnowledgeItemFiles(baseId, items)
  } catch (error) {
    logger.error(
      'Best-effort knowledge file cleanup failed; continuing',
      error instanceof Error ? error : new Error(String(error)),
      logContext
    )
  }
}

export async function deleteKnowledgeBaseDir(baseId: string): Promise<void> {
  await removeDir(getKnowledgeBaseDir(baseId))
}

function assertSafeKnowledgeRelativePath(relativePath: string): void {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error(`Invalid knowledge relative path: ${relativePath}`)
  }

  const normalized = normalizeRelativePath(relativePath)
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Invalid knowledge relative path: ${relativePath}`)
  }

  if (normalized.startsWith(`${CHERRY_META_DIR}/`) || normalized === CHERRY_META_DIR) {
    throw new Error(`Knowledge relative path is reserved: ${relativePath}`)
  }
}

function normalizeRelativePath(relativePath: string): string {
  return path.normalize(relativePath).replace(/\\/g, '/')
}

function isPathInsideBase(baseDir: string, candidatePath: string): boolean {
  const relativePath = path.relative(baseDir, candidatePath)
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}

async function assertTargetAvailable(destPath: FilePath): Promise<void> {
  try {
    await fs.lstat(destPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw error
  }

  throw new Error(`Knowledge file already exists: ${destPath}`)
}
