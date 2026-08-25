// Type-only import: the Storage bucket API used below isn't reachable
// through the RLS-scoped client, so callers pass in an admin client they
// already created — this file only needs its type, not an instance.
import type { createAdminClient } from '@/lib/supabase/admin'

export const IMPORTS_BUCKET = 'imports'
export const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024 // 20MB, per PRD § 4

export async function ensureImportsBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.storage.getBucket(IMPORTS_BUCKET)
  if (!data) {
    await admin.storage.createBucket(IMPORTS_BUCKET, { public: false, fileSizeLimit: MAX_IMPORT_FILE_SIZE })
  }
}
