export interface BranchCareersIdentityInput {
  name?: string | null;
  city?: string | null;
  domain?: string | null;
}

/**
 * Derives the branch-specific careers domain/email in the format:
 *   careers@<location>volkswagen.co.za
 * Examples:
 *   Newcastle Volkswagen -> careers@newcastlevolkswagen.co.za
 *   Ermelo Volkswagen    -> careers@ermelovolkswagen.co.za
 *   Vryheid Volkswagen   -> careers@vryheidvolkswagen.co.za
 *   Ladysmith Volkswagen -> careers@ladysmithvolkswagen.co.za
 */
export function deriveBranchCareersEmail(branch: BranchCareersIdentityInput | null | undefined): string {
  const cleanedDomain = (branch?.domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '');

  if (cleanedDomain && cleanedDomain.includes('volkswagen')) {
    return `careers@${cleanedDomain}`;
  }

  const citySlug = (branch?.city || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (citySlug) {
    return `careers@${citySlug}volkswagen.co.za`;
  }

  const nameSlug = (branch?.name || '')
    .trim()
    .toLowerCase()
    .replace(/\b(volkswagen|vw)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (nameSlug) {
    return `careers@${nameSlug}volkswagen.co.za`;
  }

  if (cleanedDomain) {
    return `careers@${cleanedDomain}`;
  }

  return 'careers@dealershipvolkswagen.co.za';
}
