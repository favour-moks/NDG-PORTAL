import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth/guards'
import { buildCorrectionsWorkbook } from '@/lib/export/corrections'
import { parseSpreadsheet } from '@/lib/import/parse'
import type { RejectionReason } from '@/lib/import/validate'
import { createClient } from '@/lib/supabase/server'
// Service-role client: re-downloading the originally uploaded file from a
// private Storage bucket the requesting editor/admin doesn't have a direct
// Storage policy for, even though RLS already confirmed via import_runs
// that they're allowed to see this import's metadata.
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const profile = await getSessionProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Sign in to download corrections.' }, { status: 401 })
  }
  if (profile.role !== 'admin' && profile.role !== 'editor') {
    return NextResponse.json({ error: 'Only editors and admins can download corrections.' }, { status: 403 })
  }

  const importRunId = new URL(request.url).searchParams.get('importRunId')
  if (!importRunId) {
    return NextResponse.json({ error: 'importRunId is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: importRun } = await supabase
    .from('import_runs')
    .select('file_path, original_name, rejections')
    .eq('id', importRunId)
    .single()

  if (!importRun) {
    return NextResponse.json({ error: 'Import run not found.' }, { status: 404 })
  }

  const rejections = (importRun.rejections ?? []) as RejectionReason[]
  if (rejections.length === 0) {
    return NextResponse.json({ error: 'This import has no rejected rows.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: fileBlob, error: downloadError } = await admin.storage
    .from('imports')
    .download(importRun.file_path)
  if (downloadError || !fileBlob) {
    return NextResponse.json({ error: 'The original file could not be retrieved.' }, { status: 500 })
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer())
  const parsed = await parseSpreadsheet(buffer, importRun.original_name)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'The original file could not be re-read.' }, { status: 500 })
  }

  const correctionsBuffer = await buildCorrectionsWorkbook(parsed.rows, rejections)
  const filename = importRun.original_name.replace(/(\.[^.]+)?$/, '-corrections.xlsx')

  return new NextResponse(new Uint8Array(correctionsBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
