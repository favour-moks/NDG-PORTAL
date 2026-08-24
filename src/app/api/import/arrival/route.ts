import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import postgres from 'postgres'
import { getSessionProfile } from '@/lib/auth/guards'
import { runArrivalImport, type ArrivalColumnMapping } from '@/lib/import/arrival'
// Service-role client: same reasoning as /api/import/route.ts — Storage
// write before a user-scoped upload path exists, and the write itself runs
// on a direct postgres.js transaction rather than supabase-js.
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureImportsBucket, IMPORTS_BUCKET, MAX_IMPORT_FILE_SIZE } from '@/lib/storage/imports-bucket'

const IMPORTS_PER_HOUR_LIMIT = 5

export async function POST(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to import an arrival accreditation feed.' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.json(
      { error: 'Only editors and admins can import an arrival accreditation feed.' },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const editionId = formData.get('editionId')
  const identifierColumn = formData.get('identifierColumn')
  const accountNumberColumn = formData.get('accountNumberColumn')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
  }
  if (typeof editionId !== 'string') {
    return NextResponse.json({ error: 'editionId is required.' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'Upload a .csv file.' }, { status: 400 })
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 20MB.' }, { status: 413 })
  }

  const mapping: ArrivalColumnMapping | undefined =
    typeof identifierColumn === 'string' && identifierColumn.length > 0
      ? {
          identifierColumn,
          accountNumberColumn:
            typeof accountNumberColumn === 'string' && accountNumberColumn.length > 0
              ? accountNumberColumn
              : undefined,
        }
      : undefined

  const sql = postgres(process.env.DATABASE_URL as string)

  try {
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from import_runs
      where uploaded_by = ${profile.id} and created_at > now() - interval '1 hour'
    `
    if (count >= IMPORTS_PER_HOUR_LIMIT) {
      return NextResponse.json(
        { error: `Import limit reached: ${IMPORTS_PER_HOUR_LIMIT} per hour. Try again later.` },
        { status: 429 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `arrival/${editionId}/${randomUUID()}-${file.name}`

    const admin = createAdminClient()
    await ensureImportsBucket(admin)
    const { error: uploadError } = await admin.storage
      .from(IMPORTS_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type || 'text/csv' })
    if (uploadError) {
      return NextResponse.json({ error: 'Could not store the uploaded file.' }, { status: 500 })
    }

    const result = await runArrivalImport(sql, buffer, {
      editionId,
      uploadedBy: profile.id,
      originalName: file.name,
      filePath: storagePath,
      mapping,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason, missingColumns: result.missingColumns },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } finally {
    await sql.end()
  }
}
