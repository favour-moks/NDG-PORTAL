import Link from 'next/link'
import type { PersonDetail } from '@/lib/query/personDetail'
import { formatNaira } from '@/lib/format/money'

// Full record + cross-edition history for one person (TASK-051) — every
// edition they've appeared in, in one place, for resolving a state's
// dispute live rather than after the conversation. Financial columns
// only render when the caller's role includes them (getPersonDetail
// already omits them for viewers; entitlementAmount stays undefined).
export function ParticipationDrawer({ person, closeHref }: { person: PersonDetail; closeHref: string }) {
  const showAmounts = person.history.some((h) => h.entitlementAmount !== undefined)

  return (
    <aside aria-label={`Details for ${person.fullName}`}>
      <Link href={closeHref}>Close</Link>
      <h2>{person.fullName}</h2>
      <dl>
        <dt>Phone</dt>
        <dd>{person.phone ?? '—'}</dd>
        <dt>BVN</dt>
        <dd>{person.maskedBvn ?? '—'}</dd>
        <dt>NIN</dt>
        <dd>{person.maskedNin ?? '—'}</dd>
      </dl>

      <h3>Participation history</h3>
      {person.history.length === 0 ? (
        <p>No participation history found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Edition</th>
              <th scope="col">Category</th>
              <th scope="col">State</th>
              <th scope="col">Sport</th>
              <th scope="col">Bank</th>
              <th scope="col">Accreditation</th>
              <th scope="col">Payment status</th>
              {showAmounts ? (
                <>
                  <th scope="col">Entitlement</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Balance</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {person.history.map((h) => (
              <tr key={h.id}>
                <td>{h.editionName}</td>
                <td>{h.categoryName ?? '—'}</td>
                <td>{h.stateName ?? '—'}</td>
                <td>{h.sportName ?? '—'}</td>
                <td>{h.bankName ?? '—'}</td>
                <td>
                  Pre-games {h.preGamesAccredited ? '✓' : '✗'} · Arrival {h.arrivalAccredited ? '✓' : '✗'}
                </td>
                <td>{h.paymentStatus ?? '—'}</td>
                {showAmounts ? (
                  <>
                    <td>{formatNaira(h.entitlementAmount)}</td>
                    <td>{formatNaira(h.amountPaid)}</td>
                    <td>{formatNaira(h.balance)}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  )
}
