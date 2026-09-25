import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./onedrive', () => ({ makeGraphRequest: vi.fn() }))
vi.mock('@/lib/mongodb/db', () => ({
  getAppSettings: vi.fn(async () => ({ cache_folder_id: 'root-id' })),
}))

import { makeGraphRequest } from './onedrive'
import { ensureCacheSubfolder } from './onedrive-cache'

const graph = vi.mocked(makeGraphRequest)
const STUDY_ID = 'abcdef12-3456'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const folder = (id: string, name: string) => json({ id, name, folder: { childCount: 1 } })
const notFound = () => json({ error: { code: 'itemNotFound' } }, 404)
const conflict = () => json({ error: { code: 'nameAlreadyExists' } }, 409)

const posts = () => graph.mock.calls.filter(([, init]) => init?.method === 'POST')
const lookups = () => graph.mock.calls.filter(([, init]) => init?.method !== 'POST')

describe('ensureCacheSubfolder', () => {
  beforeEach(() => {
    graph.mockReset()
  })

  it('reuses existing folders without POSTing', async () => {
    graph
      .mockResolvedValueOnce(folder('study-folder', 'abcdef12'))
      .mockResolvedValueOnce(folder('type-folder', 'materials'))

    await expect(ensureCacheSubfolder(STUDY_ID, 'materials')).resolves.toBe('type-folder')
    expect(posts()).toHaveLength(0)
  })

  it('looks folders up by path relative to the parent, not with $filter', async () => {
    graph
      .mockResolvedValueOnce(folder('study-folder', 'abcdef12'))
      .mockResolvedValueOnce(folder('type-folder', 'study-notes'))

    await ensureCacheSubfolder(STUDY_ID, 'study-notes')
    const urls = lookups().map(([url]) => url)
    expect(urls[0]).toContain('/me/drive/items/root-id:/abcdef12?')
    expect(urls[1]).toContain('/me/drive/items/study-folder:/study-notes?')
    for (const url of urls) {
      expect(url).not.toContain('filter')
    }
  })

  it('creates missing folders with conflictBehavior "fail"', async () => {
    graph
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ id: 'new-study' }, 201))
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(json({ id: 'new-type' }, 201))

    await expect(ensureCacheSubfolder(STUDY_ID, 'study-notes')).resolves.toBe('new-type')
    expect(posts()).toHaveLength(2)
    for (const [, init] of posts()) {
      expect(JSON.parse(init?.body as string)['@microsoft.graph.conflictBehavior']).toBe('fail')
    }
  })

  it('falls back to the lookup when creation returns 409', async () => {
    graph
      .mockResolvedValueOnce(folder('study-folder', 'abcdef12'))
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(folder('raced-type', 'materials'))

    await expect(ensureCacheSubfolder(STUDY_ID, 'materials')).resolves.toBe('raced-type')
  })

  it('ignores a same-named file and throws when no folder can be found', async () => {
    const file = () => json({ id: 'file-id', name: 'materials', file: {} })
    graph
      .mockResolvedValueOnce(folder('study-folder', 'abcdef12'))
      .mockResolvedValueOnce(file())
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(file())

    await expect(ensureCacheSubfolder(STUDY_ID, 'materials')).rejects.toThrow(
      'Failed to create or find folder: materials'
    )
  })
})
