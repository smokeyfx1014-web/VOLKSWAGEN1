import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Lock, ShieldCheck } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { GROUP_CORPORATE_INFO, getSitemapDirectory } from '../data/dealership';
import { generateBookingRef } from '../lib/utils';
import { AppRoute } from '../types/dealership';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button, Input, Label, Select } from './ui/shadcn';

export function PrivacyPolicyPage() {
  const { activeDealership } = useDealership();
  const [lookupEmail, setLookupEmail] = useState('');
  const [requestAction, setRequestAction] = useState('View stored records summary');
  const [marketingConsent, setMarketingConsent] = useState<'opt-in' | 'opt-out'>('opt-out');
  const [error, setError] = useState('');
  const [portalRef, setPortalRef] = useState<string | null>(null);

  const handlePortalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupEmail.trim() || !lookupEmail.includes('@')) {
      setError('Please enter a valid email address to verify or manage your POPIA record.');
      return;
    }
    setError('');
    setPortalRef(generateBookingRef('POPIA', activeDealership.id));
  };

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeader
          kicker="POPIA & Personal Information"
          title="Protection of Personal Information Policy"
          description={`Responsible Party: ${activeDealership.legalEntity} trading as ${activeDealership.name} (Part of the ${GROUP_CORPORATE_INFO.groupName} · Authorised FSP No. ${activeDealership.fspNumber}).`}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 text-sm leading-relaxed text-[#334155] lg:col-span-7">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-[#001E50]">
                <ShieldCheck className="h-4 w-4" />
                <span>1. Responsible Party &amp; Information Officer</span>
              </div>
              <p>
                Personal information submitted through {activeDealership.domain} is processed by{' '}
                <strong>{activeDealership.legalEntity}</strong> ({activeDealership.name}) at{' '}
                {activeDealership.physicalAddress}. For compliance enquiries or formal POPIA requests, contact{' '}
                <strong>{GROUP_CORPORATE_INFO.complianceOfficer}</strong> at{' '}
                <a
                  href={`mailto:${GROUP_CORPORATE_INFO.complianceEmail}`}
                  className="font-medium text-[#001E50] underline"
                >
                  {GROUP_CORPORATE_INFO.complianceEmail}
                </a>
                .
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-[#091224]">
                2. 365-Day Retention Policy &amp; Purchase Records
              </h3>
              <p>
                Enquiry and lead information submitted without a resulting transaction is automatically scheduled for deletion or de-identification after <strong>365 days</strong>, unless you have purchased a vehicle or service (where statutory warranty, service history, and accounting retention rules apply) or provided explicit opt-in consent for ongoing motoring communications.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-[#091224]">
                3. Third-Party Operators &amp; Group Cross-Branch Fulfilment
              </h3>
              <p>
                {activeDealership.name} and fellow Asaf Auto Sales Volkswagen dealerships rely on specialised automotive CRM, workshop scheduling, and manufacturer software operators—some hosted outside South Africa. All third-party operators are contractually bound to enforce POPIA-equivalent technical and organisational security measures.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-[#091224]">
                4. Information Regulator &amp; Your Rights
              </h3>
              <p>
                You hold the right under POPIA (Act 4 of 2013) to confirm whether we hold personal information about you, request correction or deletion, object to direct marketing, or lodge a complaint with the South African Information Regulator.
              </p>
            </div>
          </div>

          {/* Interactive POPIA Self-Service Consent Portal */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
              <div className="flex items-center gap-2 text-[#001E50]">
                <Lock className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Personal Information Portal
                </span>
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold text-[#091224]">
                Check, Update or Delete Your Data
              </h3>
              <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
                Submit a POPIA data verification, marketing consent update, or erasure request directly to our Information Officer.
              </p>

              {portalRef ? (
                <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[#001E50] font-semibold text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>POPIA Request Logged</span>
                  </div>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    Your request (<strong>{requestAction}</strong>) for{' '}
                    <span className="font-mono text-[#091224]">{lookupEmail}</span> has been routed to{' '}
                    {GROUP_CORPORATE_INFO.complianceOfficer} ({GROUP_CORPORATE_INFO.complianceEmail}).
                  </p>
                  <p className="font-mono text-xs text-[#001E50]">Reference: {portalRef}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPortalRef(null);
                      setLookupEmail('');
                    }}
                  >
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePortalSubmit} noValidate className="mt-5 space-y-4">
                  {error && (
                    <p role="alert" className="text-xs font-medium text-red-700">
                      {error}
                    </p>
                  )}

                  <div>
                    <Label htmlFor="popia-email">Your Email Address *</Label>
                    <Input
                      id="popia-email"
                      type="email"
                      placeholder="you@example.co.za"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="popia-action">Action Requested</Label>
                    <Select
                      id="popia-action"
                      value={requestAction}
                      onChange={(e) => setRequestAction(e.target.value)}
                    >
                      <option>View stored records summary</option>
                      <option>Update marketing consent preferences</option>
                      <option>Request permanent record deletion</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="popia-consent">Marketing Communication Preference</Label>
                    <Select
                      id="popia-consent"
                      value={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.value as 'opt-in' | 'opt-out')}
                    >
                      <option value="opt-out">Opt out of promotional updates</option>
                      <option value="opt-in">
                        Opt in to {activeDealership.shortName} specials &amp; news
                      </option>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full">
                    Submit POPIA Request
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  const { activeDealership } = useDealership();

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        <SectionHeader
          kicker="Legal & FSP Compliance"
          title="Website Terms & Conditions"
          description={`${activeDealership.legalEntity} trading as ${activeDealership.name} · Authorised Financial Services Provider (FSP No. ${activeDealership.fspNumber}).`}
        />

        <div className="space-y-6 text-sm leading-relaxed text-[#334155]">
          <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#001E50]">
              <FileText className="h-4 w-4" />
              <span>1. Vehicle Pricing, Specifications &amp; Pre-Owned Mileage</span>
            </div>
            <p>
              Recommended retail prices and monthly promotional deals are quoted in South African Rand (ZAR) inclusive of VAT where applicable, and exclude mandatory on-the-road, licensing, registration, and documentation fees. Vehicle specifications, paint availability, and pre-owned MasterCars odometer readings are subject to change without prior notice.
            </p>
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-2">
            <h3 className="font-display text-base font-semibold text-[#091224]">
              2. Non-Binding Finance Calculators &amp; FSP {activeDealership.fspNumber} Disclosure
            </h3>
            <p>
              All instalment calculators on this website serve solely as non-binding loan simulation tools and do not constitute formal financial advice, a credit agreement, or an offer of credit. Formal financing is facilitated by {activeDealership.legalEntity} (Authorised FSP No. {activeDealership.fspNumber}) subject to National Credit Act (NCA) affordability assessment and partner bank approval.
            </p>
          </section>

          <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-2">
            <h3 className="font-display text-base font-semibold text-[#091224]">
              3. Limitation of Liability &amp; Complaints Resolution
            </h3>
            <p>
              While {activeDealership.name} strives to ensure accurate stock and promotional listings at all times, errors and omissions are excepted (E&amp;OE). Formal customer complaints, FSP compliance queries, or dispute escalations may be directed to{' '}
              <strong>{GROUP_CORPORATE_INFO.complianceOfficer}</strong> via{' '}
              <a
                href={`mailto:${GROUP_CORPORATE_INFO.complianceEmail}`}
                className="font-medium text-[#001E50] underline"
              >
                {GROUP_CORPORATE_INFO.complianceEmail}
              </a>{' '}
              or by telephoning {activeDealership.receptionNumber}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SitemapPage({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { activeDealership } = useDealership();
  const directory = useMemo(() => getSitemapDirectory(activeDealership), [activeDealership]);

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeader
          kicker="Site Directory"
          title={`${activeDealership.name} Sitemap`}
          description={`Direct directory to every showroom, ownership, compliance, and customer support section for ${activeDealership.name}.`}
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {directory.map((section) => (
            <FadeUp key={section.group}>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-8">
                <h3 className="font-display text-lg font-semibold text-[#091224] border-b border-[#E2E8F0] pb-4">
                  {section.group}
                </h3>
                <ul className="mt-4 divide-y divide-[#E2E8F0]">
                  {section.items.map((item) => (
                    <li key={item.route} className="py-3.5">
                      <button
                        type="button"
                        onClick={() => onNavigate(item.route)}
                        className="group flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                      >
                        <div>
                          <span className="block text-sm font-semibold text-[#001E50] group-hover:underline">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#475569]">
                            {item.description}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B] transition-transform group-hover:translate-x-0.5 group-hover:text-[#001E50]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </div>
  );
}
