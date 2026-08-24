'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/guards'
import { hashIdentifier } from '@/lib/domain/identifiers'
import { createClient } from '@/lib/supabase/server'

const IDENTIFIER_PATTERN = /^\d{11}$/

export type ParticipantSearchResult = {
  id: string
  fullName: string
  categoryName: string
  stateName: string | null
  preGamesAccredited: boolean
  arrivalAccredited: boolean
  requiresArrivalAccreditation: boolean
  exclusionReason: string | null
  accountNumber: string | null
  bankId: string | null
}

// Nullable throughout to match participations_v's generated type (views
// report columns as nullable regardless of the underlying data) — id,
// full_name etc. won't actually be null for a row found by query, but the
// type system doesn't know that.
type ParticipationVRow = {
  id: string | null
  full_name: string | null
  category_name: string | null
  state_name: string | null
  pre_games_accredited: boolean | null
  arrival_accredited: boolean | null
  requires_arrival_accreditation: boolean | null
  exclusion_reason: string | null
  account_number: string | null
  bank_id: string | null
}

const SEARCH_COLUMNS =
  'id, full_name, category_name, state_name, pre_games_accredited, arrival_accredited, requires_arrival_accreditation, exclusion_reason, account_number, bank_id'

function mapRow(row: ParticipationVRow): ParticipantSearchResult {
  return {
    id: row.id ?? '',
    fullName: row.full_name ?? 'Unknown',
    categoryName: row.category_name ?? 'Unknown category',
    stateName: row.state_name,
    preGamesAccredited: row.pre_games_accredited ?? false,
    arrivalAccredited: row.arrival_accredited ?? false,
    requiresArrivalAccreditation: row.requires_arrival_accreditation ?? true,
    exclusionReason: row.exclusion_reason,
    accountNumber: row.account_number,
    bankId: row.bank_id,
  }
}

// A first-class path, not a fallback (TASK-035) — the biometric feed may
// never arrive in usable form. Search by an 11-digit identifier (exact
// hash match, never a plaintext lookup) or by name (substring, since desk
// staff type partial names live).
export async function searchParticipants(
  editionId: string,
  query: string
): Promise<ParticipantSearchResult[]> {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  if (IDENTIFIER_PATTERN.test(trimmed)) {
    const hash = hashIdentifier(trimmed)
    const { data: person } = await supabase
      .from('persons')
      .select('id')
      .or(`bvn_hash.eq.${hash},nin_hash.eq.${hash}`)
      .maybeSingle()

    if (!person) return []

    const { data } = await supabase
      .from('participations_v')
      .select(SEARCH_COLUMNS)
      .eq('edition_id', editionId)
      .eq('person_id', person.id)

    return (data ?? []).map(mapRow)
  }

  const { data } = await supabase
    .from('participations_v')
    .select(SEARCH_COLUMNS)
    .eq('edition_id', editionId)
    .ilike('full_name', `%${trimmed}%`)
    .order('full_name')
    .limit(20)

  return (data ?? []).map(mapRow)
}

export type SetAccreditationResult = { ok: true } | { ok: false; error: string }

export async function setArrivalAccreditation(
  participationId: string,
  accredited: boolean
): Promise<SetAccreditationResult> {
  const profile = await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('participations')
    .update({
      arrival_accredited: accredited,
      arrival_accredited_at: accredited ? new Date().toISOString() : null,
      arrival_source: accredited ? 'manual_desk' : null,
      arrival_accredited_by: accredited ? profile.id : null,
    })
    .eq('id', participationId)

  if (error) {
    return {
      ok: false,
      error: 'This could not be updated. The edition may be closed, or try again.',
    }
  }

  revalidatePath('/accreditation')
  return { ok: true }
}
