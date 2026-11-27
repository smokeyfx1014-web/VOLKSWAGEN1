import { CmsLeadSubmission } from '../types/dealership';

export type LeadInboxSection = 'all' | 'parts' | 'service' | 'spotters' | 'sales-other';

export function isSpotterLead(
  lead: Pick<CmsLeadSubmission, 'leadType' | 'subject' | 'details'>
): boolean {
  if (lead.leadType === 'spotter') return true;
  if (lead.leadType === 'competition-entry') {
    const hay = `${lead.subject} ${lead.details}`.toLowerCase();
    return hay.includes('spotter');
  }
  return false;
}

export function isPartsLead(lead: Pick<CmsLeadSubmission, 'leadType'>): boolean {
  return lead.leadType === 'parts';
}

export function isServiceLead(lead: Pick<CmsLeadSubmission, 'leadType'>): boolean {
  return lead.leadType === 'service';
}

export function matchesLeadInboxSection(
  lead: Pick<CmsLeadSubmission, 'leadType' | 'subject' | 'details'>,
  section: LeadInboxSection
): boolean {
  if (section === 'all') return true;
  if (section === 'parts') return isPartsLead(lead);
  if (section === 'service') return isServiceLead(lead);
  if (section === 'spotters') return isSpotterLead(lead);
  if (section === 'sales-other') {
    return !isPartsLead(lead) && !isServiceLead(lead) && !isSpotterLead(lead);
  }
  return true;
}

export function formatLeadTypeBadge(
  lead: Pick<CmsLeadSubmission, 'leadType' | 'subject' | 'details'>
): string {
  if (isSpotterLead(lead)) return 'Spotter Referral';
  switch (lead.leadType) {
    case 'parts':
      return 'Parts Request';
    case 'service':
      return 'Service Booking';
    case 'test-drive':
      return 'Test Drive';
    case 'vehicle-inquiry':
      return 'Vehicle Enquiry';
    case 'finance':
      return 'Finance Application';
    case 'event-rsvp':
      return 'Event RSVP';
    case 'competition-entry':
      return 'Prize Draw';
    case 'contact':
      return 'Contact Enquiry';
    default:
      return lead.leadType;
  }
}
