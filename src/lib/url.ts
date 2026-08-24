// A relative "?..." href resolves against the current path in the
// browser, so callers never need to know or pass the pathname — just the
// current searchParams and which key to drop.
export function hrefWithoutParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === key || v === undefined) continue
    if (Array.isArray(v)) v.forEach((value) => params.append(k, value))
    else params.append(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : '?'
}
