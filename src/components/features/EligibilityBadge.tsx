import { computeEligibility, type EligibilityInput } from '@/lib/domain/eligibility'

// Renders payable/not payable WITH the specific reasons — never just a
// checkmark. This is the component that makes "eligibility is computed"
// legible to a sceptical payment lead.
export function EligibilityBadge({ participation }: { participation: EligibilityInput }) {
  const { payable, reasons } = computeEligibility(participation)

  if (payable) {
    return <span>Payable</span>
  }

  return <span>Not payable — {reasons.map((reason) => reason.message).join('; ')}</span>
}
