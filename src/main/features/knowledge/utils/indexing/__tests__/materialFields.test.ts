import { describe, expect, it } from 'vitest'

import { type MaterialFieldSource, toMaterialRelativePath } from '../materialFields'

describe('toMaterialRelativePath', () => {
  it('uses a file’s stored relativePath when there is no processed artifact', () => {
    const file: MaterialFieldSource = {
      id: 'file-1',
      type: 'file',
      data: { source: '/docs/report.pdf', relativePath: 'report.pdf' }
    }
    expect(toMaterialRelativePath(file)).toBe('report.pdf')
  })

  it('prefers a file’s processed-artifact path (indexedRelativePath) over the source path', () => {
    const file: MaterialFieldSource = {
      id: 'file-2',
      type: 'file',
      data: { source: '/docs/report.pdf', relativePath: 'report.pdf', indexedRelativePath: 'report.md' }
    }
    expect(toMaterialRelativePath(file)).toBe('report.md')
  })

  it('uses a url’s captured snapshot path once it has one (the real raw/ file, matching the migrator)', () => {
    const url: MaterialFieldSource = {
      id: 'url-1',
      type: 'url',
      data: { source: 'https://example.com', url: 'https://example.com', relativePath: 'example-page.md' }
    }
    expect(toMaterialRelativePath(url)).toBe('example-page.md')
  })

  it('falls back to the item id for a url that has not been captured yet', () => {
    const url: MaterialFieldSource = {
      id: 'url-2',
      type: 'url',
      data: { source: 'https://example.com', url: 'https://example.com' }
    }
    expect(toMaterialRelativePath(url)).toBe('url-2')
  })

  it('uses the item id for a note, which has no base file', () => {
    const note: MaterialFieldSource = {
      id: 'note-1',
      type: 'note',
      data: { source: 'note', content: 'hello' }
    }
    expect(toMaterialRelativePath(note)).toBe('note-1')
  })
})
