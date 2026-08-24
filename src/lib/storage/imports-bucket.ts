import type { createAdminClient } from '@/lib/supabase/admin'

export const IMPORTS_BUCKET = 'imports'
export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024 // 20MB, per PRD § 4

export async function ensureImportsBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.storage.getBucket(IMPORTS_BUCKET)
  if (!data) {
    await admin.storage.createBucket(IMPORTS_BUCKET, { public: false, fileSizeLimit: MAX_IMPORT_FILE_SIZE })
  }
}
