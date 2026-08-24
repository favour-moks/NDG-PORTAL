import { NextResponse } from 'next/server'
import postgres from 'postgres'
import { getSessionProfile } from '@/lib/auth/guards'
import { generateBatch, type DisbursementFilters } from '@/lib/export/disbursement/generate'
import { computeExclusionSummary } from '@/lib/export/disbursement/exclusions'
import { getDisbursementFormat } from '@/lib/export/disbursement/formats'
import { renderDisbursementFile } from '@/lib/export/disbursement/render'

type RequestBody = {
  editionId?: string
  categoryId?: string
  stateId?: string
  sportId?: string
  committeeId?: string
  bankId?: string
  q?: string
  reference?: string
  description?: string
  force?: boolean
  formatId?: string
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// This is the magic-moment endpoint (product-vision.md § 3): filter,
// click once, receive a file the partner accepts. is_payable = true is
// enforced inside generateBatch() with no parameter that can relax it —
// this route only ever forwards whatever filter the caller supplied.
export async function POST(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to generate a disbursement.' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.json({ error: 'Only editors and admins can generate disbursements.' }, { status: 403 })
  }

  const body = (await request.json()) as RequestBody
  if (!body.editionId || !body.reference?.trim()) {
    return NextResponse.json({ error: 'editionId and reference are required.' }, { status: 400 })
  }

  const filters: DisbursementFilters = {
    editionId: body.editionId,
    categoryId: body.categoryId,
    stateId: body.stateId,
    sportId: body.sportId,
    committeeId: body.committeeId,
    bankId: body.bankId,
    q: body.q,
  }

  const sql = postgres(process.env.DATABASE_URL as string)
  try {
    const exclusions = await computeExclusionSummary(sql, filters)

    const result = await generateBatch(sql, {
      filters,
      reference: body.reference.trim(),
      description: body.description,
      generatedBy: profile.id,
      force: body.force,
    })

    if (!result.ok) {
      if (result.reason === 'duplicate_recent_batch') {
        return NextResponse.json(
          {
            warning: 'duplicate_recent_batch',
            message: `Batch "${result.existingReference}" (${result.existingCount} records) was already generated from this exact filter within the last hour.`,
            existingReference: result.existingReference,
            existingCount: result.existingCount,
            existingGeneratedAt: result.existingGeneratedAt,
          },
          { status: 409 }
        )
      }
      if (result.reason === 'duplicate_reference') {
        return NextResponse.json(
          { error: 'A batch with this reference already exists for this edition.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'No payable records match this filter.' }, { status: 422 })
    }

    const format = getDisbursementFormat(body.formatId ?? 'default')
    const generatedAt = new Date()
    const fileContent = renderDisbursementFile(format, result.rows, {
      batchId: result.batchId,
      batchReference: result.reference,
      generatedAt,
    })

    await sql`
      insert into access_logs (user_id, role, route, action, edition_id, filters, record_count)
      values (
        ${profile.id}, ${profile.role}, '/api/disbursement', 'disbursement_generate',
        ${body.editionId}, ${sql.json({ ...filters, reference: result.reference })}, ${result.recordCount}
      )
    `

    const filename = `${slugify(result.reference)}-${generatedAt.toISOString().slice(0, 10)}.${format.fileExtension}`

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': format.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Batch-Id': result.batchId,
        'X-Record-Count': String(result.recordCount),
        'X-Total-Amount': String(result.totalAmount),
        'X-Exclusion-Summary': Buffer.from(JSON.stringify(exclusions)).toString('base64'),
      },
    })
  } finally {
    await sql.end()
  }
}
