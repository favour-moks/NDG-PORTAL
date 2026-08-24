import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import postgres from 'postgres'
import { getSessionProfile } from '@/lib/auth/guards'
import { runImport } from '@/lib/import/run'
// Service-role client: writes to Storage before a user-scoped upload path
// exists, and the import write path itself runs on a direct postgres.js
// transaction rather than supabase-js — both already bypass RLS by design,
// consistent with admin.ts's documented permitted uses.
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureImportsBucket, IMPORTS_BUCKET, MAX_IMPORT_FILE_SIZE } from '@/lib/storage/imports-bucket'

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv']
const IMPORTS_PER_HOUR_LIMIT = 5

export async function POST(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to import beneficiaries.' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.json(
      { error: 'Only editors and admins can import beneficiaries.' },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const editionId = formData.get('editionId')
  const categoryId = formData.get('categoryId')
  const stateId = formData.get('stateId')
  const sportId = formData.get('sportId')
  const committeeId = formData.get('committeeId')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
  }
  if (typeof editionId !== 'string' || typeof categoryId !== 'string') {
    return NextResponse.json({ error: 'editionId and categoryId are required.' }, { status: 400 })
  }

  const extension = `.${(file.name.split('.').pop() ?? '').toLowerCase()}`
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      { error: 'This file type is not supported. Upload an .xlsx or .csv file.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File exceeds 20MB. Split it by category and upload separately.' },
      { status: 413 }
    )
  }

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

    const [category] = await sql<
      {
        requires_sport: boolean
        requires_committee: boolean
        is_state_scoped: boolean
        requires_arrival_accreditation: boolean
      }[]
    >`
      select requires_sport, requires_committee, is_state_scoped, requires_arrival_accreditation
      from categories where id = ${categoryId}
    `
    if (!category) {
      return NextResponse.json({ error: 'Unknown category.' }, { status: 400 })
    }
    if (category.is_state_scoped && typeof stateId !== 'string') {
      return NextResponse.json({ error: 'This category requires a state.' }, { status: 400 })
    }
    if (category.requires_sport && typeof sportId !== 'string') {
      return NextResponse.json({ error: 'This category requires a sport.' }, { status: 400 })
    }
    if (category.requires_committee && typeof committeeId !== 'string') {
      return NextResponse.json({ error: 'This category requires a committee.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storagePath = `${editionId}/${randomUUID()}-${file.name}`

    const admin = createAdminClient()
    await ensureImportsBucket(admin)
    const { error: uploadError } = await admin.storage
      .from(IMPORTS_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream' })
    if (uploadError) {
      return NextResponse.json({ error: 'Could not store the uploaded file.' }, { status: 500 })
    }

    const result = await runImport(sql, {
      buffer,
      originalName: file.name,
      filePath: storagePath,
      uploadedBy: profile.id,
      editionId,
      categoryId,
      stateId: category.is_state_scoped ? (stateId as string) : null,
      sportId: category.requires_sport ? (sportId as string) : null,
      committeeId: category.requires_committee ? (committeeId as string) : null,
      requiresArrivalAccreditation: category.requires_arrival_accreditation,
      piiEncryptionKey: process.env.PII_ENCRYPTION_KEY as string,
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
