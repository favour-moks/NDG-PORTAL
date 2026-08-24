import { NextResponse } from 'next/server'
import postgres from 'postgres'
import { getSessionProfile } from '@/lib/auth/guards'
import { applyPaymentResults, parseResultFile } from '@/lib/import/payment-results'

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv']

export async function POST(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to import payment results.' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.json({ error: 'Only editors and admins can import payment results.' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const batchId = formData.get('batchId')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
  }
  if (typeof batchId !== 'string' || !batchId) {
    return NextResponse.json({ error: 'batchId is required.' }, { status: 400 })
  }

  const extension = `.${(file.name.split('.').pop() ?? '').toLowerCase()}`
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      { error: 'This file type is not supported. Upload an .xlsx or .csv file.' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = await parseResultFile(buffer, file.name)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.reason, missingColumns: parsed.missingColumns }, { status: 400 })
  }

  const sql = postgres(process.env.DATABASE_URL as string)
  try {
    const [batch] = await sql<{ id: string; edition_id: string }[]>`
      select id, edition_id from payment_batches where id = ${batchId}
    `
    if (!batch) {
      return NextResponse.json({ error: 'That batch could not be found.' }, { status: 404 })
    }

    const summary = await applyPaymentResults(sql, batchId, parsed.rows)

    await sql`
      insert into import_runs (
        edition_id, kind, file_path, original_name, row_count, accepted_count, rejected_count, status, uploaded_by
      ) values (
        ${batch.edition_id}, 'payment_results', ${`results/${batchId}/${file.name}`}, ${file.name},
        ${parsed.rows.length}, ${summary.matched}, ${summary.unmatched + summary.ambiguous}, 'completed', ${profile.id}
      )
    `

    return NextResponse.json(summary)
  } finally {
    await sql.end()
  }
}
