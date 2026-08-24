const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Cursor = { name: string; id: string }

// Opaque to the client — just base64url JSON. The point isn't secrecy,
// it's that the URL carries a stable pointer instead of an offset (offset
// pagination degrades badly past a few thousand rows).
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

// Cursors round-trip through a client-editable URL, so the shape is
// re-validated on the way back in — including that `id` is actually a
// UUID, since it gets interpolated into a PostgREST filter string below.
export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf-8'))
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      'name' in decoded &&
      'id' in decoded &&
      typeof (decoded as { name: unknown }).name === 'string' &&
      typeof (decoded as { id: unknown }).id === 'string' &&
      UUID_PATTERN.test((decoded as { id: string }).id)
    ) {
      return decoded as Cursor
    }
    return null
  } catch {
    return null
  }
}

// PostgREST filter strings use commas and parentheses as syntax, and
// double quotes to allow arbitrary text inside a value — so a name
// containing any of those has to be quoted and have its own quotes/
// backslashes escaped, the same way any string embedded in a larger
// grammar does.
function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

type OrFilterable<T> = { or: (filters: string) => T }

// Keyset pagination on (full_name, id): "the next page starts after this
// name, and after this id for ties on that name." supabase-js has no
// native tuple-comparison operator, so this expresses
// `(full_name, id) > (cursor.name, cursor.id)` as the equivalent OR of two
// conditions instead — still runs through the caller's own RLS-scoped
// client, unlike a raw postgres.js query would.
export function applyKeysetCursor<T extends OrFilterable<T>>(query: T, cursor: Cursor | null): T {
  if (!cursor) return query
  const escapedName = escapePostgrestValue(cursor.name)
  return query.or(`full_name.gt.${escapedName},and(full_name.eq.${escapedName},id.gt.${cursor.id})`)
}
