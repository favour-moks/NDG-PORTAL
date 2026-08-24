import { describe, expect, it } from 'vitest'
import { applyKeysetCursor, decodeCursor, encodeCursor } from './keyset'

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { name: 'Ada Obi', id: '11111111-1111-1111-1111-111111111111' }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('returns null for a missing value', () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('returns null for garbage input rather than throwing', () => {
    expect(decodeCursor('not-valid-base64-json!!!')).toBeNull()
  })

  it('rejects a cursor whose id is not a UUID (the value round-trips through a client-editable URL)', () => {
    const tampered = Buffer.from(JSON.stringify({ name: 'Ada Obi', id: 'not-a-uuid' })).toString(
      'base64url'
    )
    expect(decodeCursor(tampered)).toBeNull()
  })

  it('rejects a cursor missing required fields', () => {
    const incomplete = Buffer.from(JSON.stringify({ name: 'Ada Obi' })).toString('base64url')
    expect(decodeCursor(incomplete)).toBeNull()
  })
})

describe('applyKeysetCursor', () => {
  function fakeQuery() {
    const calls: string[] = []
    const query = {
      or(filter: string) {
        calls.push(filter)
        return query
      },
    }
    return { query, calls }
  }

  it('does nothing when there is no cursor', () => {
    const { query, calls } = fakeQuery()
    applyKeysetCursor(query, null)
    expect(calls).toEqual([])
  })

  it('builds the tuple-comparison OR filter for a plain name', () => {
    const { query, calls } = fakeQuery()
    applyKeysetCursor(query, { name: 'Ada Obi', id: '11111111-1111-1111-1111-111111111111' })
    expect(calls).toEqual([
      'full_name.gt."Ada Obi",and(full_name.eq."Ada Obi",id.gt.11111111-1111-1111-1111-111111111111)',
    ])
  })

  it('escapes double quotes and backslashes in the name', () => {
    const { query, calls } = fakeQuery()
    applyKeysetCursor(query, { name: 'O"Brien\\Smith', id: '11111111-1111-1111-1111-111111111111' })
    expect(calls[0]).toContain('full_name.gt."O\\"Brien\\\\Smith"')
  })
})
