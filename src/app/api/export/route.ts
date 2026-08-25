import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { logAccess } from '@/lib/audit/log'
import { parseFiltersFromSearchParams } from '@/lib/query/participations'
import { fetchAllParticipations } from '@/lib/export/fetchAll'
import { buildParticipationsWorkbook } from '@/lib/export/xlsx'
import { buildParticipationsPdf } from '@/lib/export/pdf'

const FORMATS = ['xlsx', 'pdf'] as const
type Format = (typeof FORMATS)[number]

const DRM_DISCLAIMER = 'Any individual who is not accredited will not be paid.'

function isFormat(value: string | null): value is Format {
  return FORMATS.includes(value as Format)
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Same filters, same RLS-scoped client, same view selection as the list
// (fetchAllParticipations calls listParticipations under the hood) — that
// identity is what guarantees the exported row count always matches the
// screen's totalCount, per TASK-047/054's shared verify criterion.
export async function GET(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  const editionId = params.get('edition')
  const categoryId = params.get('category')
  const format = params.get('format')

  if (!editionId || !categoryId) {
    return NextResponse.json({ error: 'edition and category are required.' }, { status: 400 })
  }
  if (!isFormat(format)) {
    return NextResponse.json({ error: 'format must be xlsx or pdf.' }, { status: 400 })
  }

  const stateId = params.get('state') ?? undefined

  const filters = parseFiltersFromSearchParams(Object.fromEntries(params.entries()), {
    editionId,
    categoryId,
    stateId,
  })

  const supabase = await createClient()
  const [{ data: edition }, { data: category }, { data: state }] = await Promise.all([
    supabase.from('editions').select('name').eq('id', editionId).maybeSingle(),
    supabase.from('categories').select('name').eq('id', categoryId).maybeSingle(),
    stateId
      ? supabase.from('states').select('name').eq('id', stateId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!edition || !category) {
    return NextResponse.json({ error: 'That edition or category could not be found.' }, { status: 404 })
  }

  const isDrm = params.get('drm') === '1'
  if (isDrm && profile.role === 'viewer') {
    return NextResponse.json({ error: 'The DRM export is editor/admin only.' }, { status: 403 })
  }

  const rows = await fetchAllParticipations(filters)

  const titleParts = [state?.name, category.name, edition.name].filter(Boolean)
  const title = titleParts.join(' — ')
  const filenameBase = slugify((isDrm ? ['DRM', ...titleParts] : titleParts).join('-') || 'participants')
  const variant = isDrm ? 'drm' : 'standard'

  let body: Buffer | ArrayBuffer
  let contentType: string
  let filename: string

  if (format === 'xlsx') {
    body = await buildParticipationsWorkbook(rows, profile.role, title, variant)
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    filename = `${filenameBase}.xlsx`
  } else {
    body = await buildParticipationsPdf(rows, profile.role, title, isDrm ? DRM_DISCLAIMER : undefined, variant)
    contentType = 'application/pdf'
    filename = `${filenameBase}.pdf`
  }

  await logAccess({
    action: 'export',
    route: '/api/export',
    editionId,
    filters: { ...filters, format },
    recordCount: rows.length,
  })

  return new NextResponse(body as BodyInit, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
