import postgres from 'postgres'

export type RateLimitCheck = { allowed: boolean; count: number }

// Durable, not in-memory — a serverless function invocation can't be
// trusted to keep counter state between requests. `bucket` is caller-
// defined (e.g. `auth:<ip>`, `import:<userId>`) so the same table backs
// every limit in the app; make_interval() takes the window as a bound
// parameter rather than string-interpolating it into an interval
// literal.
export async function checkRateLimit(
  sql: postgres.Sql,
  bucket: string,
  limit: number,
  windowMinutes: number
): Promise<RateLimitCheck> {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from rate_limit_events
    where bucket = ${bucket} and created_at > now() - make_interval(mins => ${windowMinutes})
  `
  return { allowed: count < limit, count }
}

export async function recordRateLimitEvent(sql: postgres.Sql, bucket: string): Promise<void> {
  await sql`insert into rate_limit_events (bucket) values (${bucket})`
}
