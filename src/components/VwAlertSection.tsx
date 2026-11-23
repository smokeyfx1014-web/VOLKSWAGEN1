import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { CONTACT_CARD_ASSETS, GROUP_CORPORATE_INFO } from '../data/dealership';
import { generateBookingRef, toTelHref } from '../lib/utils';
import { AppRoute } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button, Input, Label } from './ui/shadcn';

interface VwAlertBannerProps {
  onOpenVwAlert: () => void;
}

export function VwAlertEmergencyBar({ onOpenVwAlert }: VwAlertBannerProps) {
  const { activeDealership } = useDealership();

  return (
    <section
      aria-label="24/7 Volkswagen Roadside Assistance"
      className="border-b border-[#001E50]/20 bg-[#001E50] text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-start sm:items-center gap-3">
          <ShieldAlert
            className="h-5 w-5 shrink-0 text-white/90 mt-0.5 sm:mt-0"
            aria-hidden="true"
          />
          <p className="text-xs sm:text-sm text-white/90">
            <span className="font-semibold text-white">24/7 Volkswagen Alert Roadside Assist:</span>{' '}
            National breakdown &amp; customer care on{' '}
            <a
              href={toTelHref(activeDealership.roadsideAssist)}
              className="font-mono font-semibold text-white underline underline-offset-4 tabular-nums"
            >
              {activeDealership.roadsideAssist}
            </a>{' '}
            or{' '}
            <a
              href={toTelHref(GROUP_CORPORATE_INFO.vwRoadsideTollFree)}
              className="font-mono font-semibold text-white underline underline-offset-4 tabular-nums"
            >
              {GROUP_CORPORATE_INFO.vwRoadsideTollFree}
            </a>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenVwAlert}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-white hover:text-white/80 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Recall Check &amp; VW Alert Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

interface VwAlertPageProps {
  onNavigate: (route: AppRoute) => void;
  onBookService: () => void;
}

export function VwAlertPage({ onNavigate, onBookService }: VwAlertPageProps) {
  const { activeDealership } = useDealership();
  const [vin, setVin] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');
  const [checkRef, setCheckRef] = useState<string | null>(null);

  const handleVinLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length < 11) {
      setError(
        'Please enter at least 11 characters (or your full 17-digit VIN) to run a safety recall check.'
      );
      return;
    }
    if (!contactPhone.trim()) {
      setError('Please provide a mobile number so our workshop can confirm any campaign action.');
      return;
    }
    setError('');
    setCheckRef(generateBookingRef('VWA', activeDealership.id));
  };

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker="Volkswagen Alert · Roadside & Safety"
          title="24/7 Emergency Roadside Assistance & Safety Recall Verification"
          description={`Whether you need urgent breakdown recovery anywhere in Southern Africa or want to verify active Volkswagen factory safety campaigns by VIN at ${activeDealership.name}, our team is ready.`}
        />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Roadside Contacts & Coverage */}
          <FadeUp className="space-y-6 lg:col-span-6">
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <DealershipImage
                asset={CONTACT_CARD_ASSETS.vwAlert}
                alt="Volkswagen Alert 24/7 Roadside Assistance"
                className="border-b border-[#E2E8F0]"
              />
              <div className="p-6 sm:p-8 space-y-5">
                <h3 className="font-display text-xl font-semibold text-[#091224]">
                  Direct Emergency, Finance &amp; Insurance Lines
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <a
                    href={toTelHref(activeDealership.roadsideAssist)}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-4 hover:border-[#001E50] transition-colors"
                  >
                    <span className="block text-[11px] text-[#64748B]">VW Alert (SA)</span>
                    <span className="mt-1 block font-mono text-base font-semibold text-[#001E50] tabular-nums">
                      {activeDealership.roadsideAssist}
                    </span>
                  </a>
                  <a
                    href={toTelHref(activeDealership.vwFinancialServices)}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-4 hover:border-[#001E50] transition-colors"
                  >
                    <span className="block text-[11px] text-[#64748B]">VW Financial Services</span>
                    <span className="mt-1 block font-mono text-base font-semibold text-[#001E50] tabular-nums">
                      {activeDealership.vwFinancialServices}
                    </span>
                  </a>
                  <a
                    href={toTelHref(activeDealership.volkswagensure)}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-4 hover:border-[#001E50] transition-colors"
                  >
                    <span className="block text-[11px] text-[#64748B]">VolkswagenSure</span>
                    <span className="mt-1 block font-mono text-base font-semibold text-[#001E50] tabular-nums">
                      {activeDealership.volkswagensure}
                    </span>
                  </a>
                </div>

                <ul className="space-y-2.5 text-sm text-[#334155] pt-2">
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                    <span>
                      24-hour mechanical breakdown recovery, flat tyre assistance, fuel delivery, and towing across South Africa and cross-border ({GROUP_CORPORATE_INFO.vwRoadsideCrossBorder}).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                    <span>
                      Included as standard across new Volkswagen warranties and certified MasterCars vehicles.
                    </span>
                  </li>
                </ul>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={onBookService}>Book Workshop Inspection</Button>
                  <Button variant="outline" onClick={() => onNavigate('/contact')}>
                    <Phone className="h-4 w-4" />
                    <span>
                      {activeDealership.shortName} ({activeDealership.receptionNumber})
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Right: Interactive VIN Recall Lookup & Safety Verification */}
          <FadeUp delay={0.1} className="lg:col-span-6">
            <div className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-8">
              <div className="flex items-center gap-2.5 text-[#001E50]">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wider uppercase">
                  Safety Campaign &amp; Recall Lookup
                </span>
              </div>
              <h3 className="mt-3 font-display text-2xl font-semibold text-[#091224]">
                Check Your Vehicle by VIN Number
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Enter your 17-character Vehicle Identification Number (found on your licence disc or windscreen base) to check whether your Volkswagen has any open factory recall or software campaign at {activeDealership.name}.
              </p>

              {checkRef ? (
                <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                  <div className="flex items-center gap-3 text-[#001E50]">
                    <CheckCircle2 className="h-6 w-6" />
                    <h4 className="font-display text-lg font-semibold">
                      VIN Verification Request Logged
                    </h4>
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed">
                    Our {activeDealership.name} Service Reception is cross-checking VIN{' '}
                    <span className="font-mono font-semibold text-[#091224]">
                      {vin.toUpperCase()}
                    </span>{' '}
                    against Volkswagen Group Africa’s live campaign register and will contact you on{' '}
                    <span className="font-mono text-[#091224]">{contactPhone}</span> if any complimentary safety recall work is required.
                  </p>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-xs font-mono text-[#334155]">
                    Verification Ref: <span className="font-semibold text-[#001E50]">{checkRef}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVin('');
                      setCheckRef(null);
                    }}
                  >
                    Check Another VIN
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleVinLookup} noValidate className="mt-6 space-y-4">
                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="recall-vin">17-Character VIN / Chassis Number *</Label>
                    <Input
                      id="recall-vin"
                      placeholder="e.g. AAVZZZAWZPU012345"
                      maxLength={17}
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="recall-phone">Mobile Number for Workshop Confirmation *</Label>
                    <Input
                      id="recall-phone"
                      type="tel"
                      placeholder="e.g. 083 555 0192"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full sm:w-auto">
                    Verify Recall Status
                  </Button>
                </form>
              )}
            </div>
          </FadeUp>
        </div>
      </div>
    </div>
  );
}
