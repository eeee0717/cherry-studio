import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as PathStorage from '../../storage/pathStorage'

const { writeFileIntoKnowledgeBaseAtMock } = vi.hoisted(() => ({
  writeFileIntoKnowledgeBaseAtMock: vi.fn()
}))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory()
})

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() })
  }
}))

// Keep reserveImportedFileRelativePath real (it is pure); only stub the disk write so
// the test exercises name derivation + dedupe without touching the filesystem.
vi.mock('../../storage/pathStorage', async () => {
  const actual = await vi.importActual<typeof PathStorage>('../../storage/pathStorage')
  return { ...actual, writeFileIntoKnowledgeBaseAt: writeFileIntoKnowledgeBaseAtMock }
})

const { deriveNoteSnapshotSlug, captureNoteSnapshotFile } = await import('../noteSnapshot')

describe('deriveNoteSnapshotSlug', () => {
  it('uses the note source title', () => {
    expect(deriveNoteSnapshotSlug('React best practices')).toBe('React best practices')
  })

  it('sanitizes filesystem-forbidden characters out of the title', () => {
    expect(deriveNoteSnapshotSlug('A/B:C')).toBe('A_B_C')
  })

  it('truncates an overlong title to the snapshot length cap', () => {
    expect(deriveNoteSnapshotSlug('a'.repeat(200))).toHaveLength(80)
  })

  it('falls back to "note" when the title sanitizes to nothing usable', () => {
    expect(deriveNoteSnapshotSlug('   ')).toBe('note')
  })
})

describe('captureNoteSnapshotFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The real writer returns the relative path it wrote to; mirror that.
    writeFileIntoKnowledgeBaseAtMock.mockImplementation(async (_baseId: string, relativePath: string) => relativePath)
  })

  it('writes the content verbatim under a title-derived name and returns its relative path', async () => {
    const content = '# My note\n\nbody'
    const relativePath = await captureNoteSnapshotFile('kb-1', 'My note', content, new Set())

    expect(relativePath).toBe('My note.md')
    // Written verbatim — no cherry frontmatter, so the file text round-trips exactly.
    expect(writeFileIntoKnowledgeBaseAtMock).toHaveBeenCalledWith('kb-1', 'My note.md', content)
  })

  it('renames around an already-reserved snapshot name', async () => {
    const reserved = new Set<string>(['My note.md'])
    const relativePath = await captureNoteSnapshotFile('kb-1', 'My note', 'body', reserved)

    expect(relativePath).toBe('My note_1.md')
    expect(writeFileIntoKnowledgeBaseAtMock).toHaveBeenCalledWith('kb-1', 'My note_1.md', 'body')
  })
})
