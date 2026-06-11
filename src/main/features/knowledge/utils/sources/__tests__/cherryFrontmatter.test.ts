import { describe, expect, it } from 'vitest'

import { serializeCherryUrlSnapshotFrontmatter, stripCherryFrontmatter } from '../cherryFrontmatter'

describe('serializeCherryUrlSnapshotFrontmatter', () => {
  it('renders the cherry block with the source URL and capture time', () => {
    const block = serializeCherryUrlSnapshotFrontmatter({
      source: 'https://example.com/guide',
      capturedAt: '2026-06-11T10:00:00.000Z'
    })

    expect(block).toBe(
      [
        '---',
        'cherry:',
        '  type: url-snapshot',
        '  source: "https://example.com/guide"',
        '  captured_at: "2026-06-11T10:00:00.000Z"',
        '---',
        ''
      ].join('\n')
    )
  })

  it('renders origin alongside the migration-time capture for reconstructed snapshots', () => {
    const block = serializeCherryUrlSnapshotFrontmatter({
      source: 'https://example.com/guide',
      capturedAt: '2026-06-11T10:00:00.000Z',
      origin: 'v1-migration'
    })

    expect(block).toContain('  captured_at: "2026-06-11T10:00:00.000Z"\n')
    expect(block).toContain('  origin: "v1-migration"\n')
  })
})

describe('stripCherryFrontmatter', () => {
  const roundTrips = (body: string, source = 'https://example.com/p') => {
    const file = serializeCherryUrlSnapshotFrontmatter({ source, capturedAt: '2026-06-11T00:00:00.000Z' }) + body
    expect(stripCherryFrontmatter(file)).toBe(body)
  }

  it('is the exact inverse of serialize for a plain body', () => {
    roundTrips('# Title\n\nbody text\n')
  })

  it('round-trips a body that itself starts with user frontmatter', () => {
    roundTrips('---\ntags: [a, b]\n---\n# Doc\n')
  })

  it('round-trips a body containing a horizontal-rule --- line', () => {
    roundTrips('above\n\n---\n\nbelow\n')
  })

  it('round-trips a source URL containing --- and # characters', () => {
    roundTrips('body\n', 'https://example.com/a---b#frag')
  })

  it('round-trips an empty body', () => {
    roundTrips('')
  })

  it('leaves text without frontmatter untouched', () => {
    expect(stripCherryFrontmatter('# Just markdown\n')).toBe('# Just markdown\n')
  })

  it('leaves user frontmatter without a cherry key untouched', () => {
    const text = '---\ntitle: Mine\ntags: [a]\n---\nbody\n'
    expect(stripCherryFrontmatter(text)).toBe(text)
  })

  it('leaves an unterminated frontmatter block untouched', () => {
    const text = '---\ncherry:\n  type: url-snapshot\nno closing delimiter\n'
    expect(stripCherryFrontmatter(text)).toBe(text)
  })

  it('does not treat an indented cherry line as the marker', () => {
    const text = '---\nnested:\n  cherry: value\n---\nbody\n'
    expect(stripCherryFrontmatter(text)).toBe(text)
  })

  it('strips only the leading cherry block, never a later one', () => {
    const body = 'intro\n---\ncherry:\n  type: url-snapshot\n---\nrest\n'
    roundTrips(body)
  })
})
