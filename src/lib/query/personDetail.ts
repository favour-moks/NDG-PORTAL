import postgres from 'postgres'
import { requireSession } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { maskIdentifier } from '@/lib/domain/identifiers'

type HistoryRow = {
  id: string
  edition_id: string
  category_name: string | null
  state_name: string | null
  sport_name: string | null
  bank_name: string | null
  account_number?: string | null
  pre_games_accredited: boolean | null
  arrival_accredited: boolean | null
  is_payable: boolean | null
  payment_status: string | null
  entitlement_amount?: number | null
  amount_paid?: number | null
  balance?: number | null
}

export type PersonParticipationHistory = {
  id: string
  editionId: string
  editionName: string
  categoryName: string | null
  stateName: string | null
  sportName: string | null
  bankName: string | null
  accountNumber?: string | null
  preGamesAccredited: boolean | null
  arrivalAccredited: boolean | null
  isPayable: boolean | null
  paymentStatus: string | null
  entitlementAmount?: number | null
  amountPaid?: number | null
  balance?: number | null
}

export type PersonDetail = {
  id: string
  fullName: string
  phone: string | null
  maskedBvn: string | null
  maskedNin: string | null
  history: PersonParticipationHistory[]
}

const VIEWER_HISTORY_COLUMNS =
  'id, edition_id, category_name, state_name, sport_name, bank_name, pre_games_accredited, arrival_accredited, is_payable, payment_status'
const EDITOR_HISTORY_COLUMNS =
  'id, edition_id, category_name, state_name, sport_name, bank_name, account_number, pre_games_accredited, arrival_accredited, is_payable, payment_status, entitlement_amount, amount_paid, balance'

// Full record + cross-edition history for one person (TASK-051) — the
// payoff of splitting persons from participations: every edition this
// person appears in, in one place, for resolving a dispute live.
//
// Identifiers are masked here, never full — decrypting to compute the
// mask uses the same direct-connection + PII_ENCRYPTION_KEY path as the
// import pipeline, but isn't logged as a reveal (the reveal action,
// TASK-074/Phase 5, is specifically for returning the *unmasked* value).
export async function getPersonDetail(personId: string): Promise<PersonDetail | null> {
  const profile = await requireSession()
  const supabase = await createClient()

  // RLS on `persons` (008_rls.sql, persons_viewer_via_participation)
  // already restricts a viewer to only persons who have a participation
  // in a state they can access — a null result here means either the
  // person doesn't exist or this user isn't authorized to see them, and
  // both are "not found" to the caller. This is also what authorizes the
  // decrypt below: reaching that point already proved legitimate access.
  const { data: person } = await supabase
    .from('persons')
    .select('id, full_name, phone, bvn_encrypted, nin_encrypted')
    .eq('id', personId)
    .maybeSingle()

  if (!person) return null

  const isViewer = profile.role === 'viewer'
  const viewName = isViewer ? 'participations_viewer_v' : 'participations_v'
  const columns = isViewer ? VIEWER_HISTORY_COLUMNS : EDITOR_HISTORY_COLUMNS

  const { data: participationsData } = await supabase.from(viewName).select(columns).eq('person_id', personId)
  const participations = (participationsData ?? []) as unknown as HistoryRow[]

  const editionIds = [...new Set(participations.map((p) => p.edition_id))]
  const { data: editions } =
    editionIds.length > 0
      ? await supabase.from('editions').select('id, name').in('id', editionIds)
      : { data: [] as { id: string; name: string }[] }
  const editionNameById = new Map((editions ?? []).map((e) => [e.id, e.name]))

  const history: PersonParticipationHistory[] = participations
    .map((p) => ({
      id: p.id,
      editionId: p.edition_id,
      editionName: editionNameById.get(p.edition_id) ?? 'Unknown edition',
      categoryName: p.category_name,
      stateName: p.state_name,
      sportName: p.sport_name,
      bankName: p.bank_name,
      accountNumber: p.account_number,
      preGamesAccredited: p.pre_games_accredited,
      arrivalAccredited: p.arrival_accredited,
      isPayable: p.is_payable,
      paymentStatus: p.payment_status,
      entitlementAmount: p.entitlement_amount,
      amountPaid: p.amount_paid,
      balance: p.balance,
    }))
    .sort((a, b) => b.editionName.localeCompare(a.editionName))

  let maskedBvn: string | null = null
  let maskedNin: string | null = null

  if (person.bvn_encrypted || person.nin_encrypted) {
    const sql = postgres(process.env.DATABASE_URL as string)
    try {
      const key = process.env.PII_ENCRYPTION_KEY as string
      const [decrypted] = await sql<{ bvn: string | null; nin: string | null }[]>`
        select
          ${person.bvn_encrypted ? sql`decrypt_identifier(bvn_encrypted, ${key})` : sql`null`} as bvn,
          ${person.nin_encrypted ? sql`decrypt_identifier(nin_encrypted, ${key})` : sql`null`} as nin
        from persons where id = ${personId}
      `
      maskedBvn = decrypted?.bvn ? maskIdentifier(decrypted.bvn) : null
      maskedNin = decrypted?.nin ? maskIdentifier(decrypted.nin) : null
    } finally {
      await sql.end()
    }
  }

  return {
    id: person.id,
    fullName: person.full_name,
    phone: person.phone,
    maskedBvn,
    maskedNin,
    history,
  }
}
