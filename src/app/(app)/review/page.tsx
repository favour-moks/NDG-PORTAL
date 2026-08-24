import { requireRole } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { ComparisonPair, type ParticipationSummary } from '@/components/features/review/ComparisonPair'

export default async function ReviewPage() {
  await requireRole(['admin', 'editor'])
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('duplicate_reviews')
    .select(
      'id, match_type, similarity_score, is_blocking, participation_id, matched_person_id, matched_edition_id'
    )
    .eq('status', 'open')
    .order('is_blocking', { ascending: false })
    .order('created_at', { ascending: true })

  if (!reviews || reviews.length === 0) {
    return (
      <main>
        <h1>Review Queue</h1>
        <p>No records need review.</p>
      </main>
    )
  }

  const newParticipationIds = reviews.map((review) => review.participation_id)
  const matchedPersonIds = reviews.map((review) => review.matched_person_id)
  const editionIds = [...new Set(reviews.map((review) => review.matched_edition_id))]

  const [{ data: newParticipations }, { data: matchedCandidates }, { data: editions }] = await Promise.all([
    supabase
      .from('participations_v')
      .select('id, full_name, category_name, state_name, bank_name, account_number')
      .in('id', newParticipationIds),
    supabase
      .from('participations_v')
      .select('id, person_id, edition_id, full_name, category_name, state_name, bank_name, account_number')
      .in('person_id', matchedPersonIds),
    supabase.from('editions').select('id, name, is_reference').in('id', editionIds),
  ])

  function findMatched(personId: string, editionId: string): ParticipationSummary | undefined {
    return matchedCandidates?.find((p) => p.person_id === personId && p.edition_id === editionId)
  }

  return (
    <main>
      <h1>Review Queue</h1>
      {reviews.map((review) => {
        const current = newParticipations?.find((p) => p.id === review.participation_id)
        if (!current) return null

        const matched = findMatched(review.matched_person_id, review.matched_edition_id)
        const matchedEdition = editions?.find((e) => e.id === review.matched_edition_id)

        return (
          <ComparisonPair
            key={review.id}
            reviewId={review.id}
            matchType={review.match_type}
            similarityScore={review.similarity_score}
            isBlocking={review.is_blocking}
            current={current}
            matched={matched}
            matchedEditionName={matchedEdition?.name}
            matchedEditionIsReference={matchedEdition?.is_reference}
          />
        )
      })}
    </main>
  )
}
