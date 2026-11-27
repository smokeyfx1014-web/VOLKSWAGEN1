import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { MASTERCARS_HERO_ASSET } from '../data/dealership';
import { formatZAR } from '../lib/utils';
import {
  CmsPromotion,
  CmsVehicle,
  DealershipId,
} from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { SectionHeader } from './MotionPrimitives';
import { PromotionMedia } from './PromotionMedia';
import { VehicleSearchShowcase } from './VehicleSearchShowcase';
import { Button } from './ui/shadcn';

interface ShowroomInventoryViewProps {
  mode: 'vehicles' | 'specials';
  onNavigate?: (route: import('../types/dealership').AppRoute) => void;
  onBookTestDrive: (vehicleName: string, homeDealershipId?: DealershipId | null) => void;
  onEnquireDeal: (item: {
    title: string;
    price: number;
    dealSummary?: string;
    homeDealershipId?: DealershipId | null;
  }) => void;
  onApplyFinance?: (vehicle: CmsVehicle) => void;
  onEnterCompetition?: (competitionTitle: string) => void;
}

const MASTERCARS_PILLARS = [
  { label: 'Age & Mileage Cap', value: 'Under 5 Years · < 120,000 km' },
  { label: 'Technical Audit', value: '80-Point Workshop Inspection' },
  { label: 'Buyer Protection', value: '7-Day / 1,000 km Exchange Policy' },
  { label: 'Peace of Mind', value: '12-Month Certification & VW Alert' },
];

export function ShowroomInventoryView({
  mode,
  onNavigate,
  onBookTestDrive,
  onEnquireDeal,
  onApplyFinance,
  onEnterCompetition,
}: ShowroomInventoryViewProps) {
  const { activeDealership, dealershipsById, groupProfile } = useDealership();
  const { activeSpecials, activeCompetitions, loadingCatalog } =
    useDealershipData();

  const [maxPrice, setMaxPrice] = useState<number>(2500000);
  const [maxMonthly, setMaxMonthly] = useState<number>(35000);

  const filteredSpecials = useMemo(() => {
    return activeSpecials.filter((sp) => {
      if (sp.offerPrice > 0 && sp.offerPrice > maxPrice) return false;
      if (sp.monthlyFrom > 0 && sp.monthlyFrom > maxMonthly) return false;
      return true;
    });
  }, [activeSpecials, maxPrice, maxMonthly]);

  const resetFilters = () => {
    setMaxPrice(2500000);
    setMaxMonthly(35000);
  };

  if (mode === 'specials') {
    return (
      <div className="bg-[#F8FAFC] pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-14">
          <div>
            <SectionHeader
              kicker="Active Dealership & Group Campaigns"
              title={`${activeDealership.name} Specials & Promotions`}
              description={`Live dated specials and competitions available at ${activeDealership.shortName} (including ${groupProfile.groupName}-wide MASTER campaigns and ${activeDealership.shortName}-exclusive deals).`}
            />

            {/* Specials Filter Bar */}
            <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">
                    Max Offer Price: {formatZAR(maxPrice)}
                  </label>
                  <input
                    type="range"
                    min={250000}
                    max={1200000}
                    step={25000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-[#001E50]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1.5">
                    Max Monthly Instalment: {formatZAR(maxMonthly)} p/m
                  </label>
                  <input
                    type="range"
                    min={3000}
                    max={20000}
                    step={500}
                    value={maxMonthly}
                    onChange={(e) => setMaxMonthly(Number(e.target.value))}
                    className="w-full accent-[#001E50]"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[#64748B] tabular-nums">
                    {filteredSpecials.length} live{' '}
                    {filteredSpecials.length === 1 ? 'special' : 'specials'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </Button>
                </div>
              </div>
            </div>

            {loadingCatalog && filteredSpecials.length === 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-96 rounded-xl border border-[#E2E8F0] bg-white animate-pulse"
                  />
                ))}
              </div>
            ) : filteredSpecials.length === 0 ? (
              <div className="mt-10 rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
                <p className="text-base font-medium text-[#091224]">
                  No active dated specials match your current criteria for {activeDealership.shortName}.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredSpecials.map((special: CmsPromotion) => {
                  const scopeLabel =
                    special.scope === 'MASTER'
                      ? 'All Group Branches'
                      : `${dealershipsById[special.dealershipId ?? activeDealership.id]?.shortName ?? activeDealership.shortName} Exclusive`;

                  return (
                    <motion.article
                      key={special.id}
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
                    >
                      <div className="relative aspect-4/3 w-full overflow-hidden border-b border-[#E2E8F0] bg-[#F1F5F9]">
                        <PromotionMedia
                          src={special.imageUrl}
                          alt={special.title}
                          mediaType={special.mediaType}
                          hoverZoom
                        />
                        <div className="absolute top-3 left-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#001E50] shadow-xs">
                          {scopeLabel}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                            <span className="truncate">{special.location || activeDealership.city}</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-[#00437A] shrink-0">
                              <Sparkles className="h-3 w-3" />
                              Active Special
                            </span>
                          </div>

                          <h3 className="mt-2 font-display text-xl font-semibold text-[#091224]">
                            {special.title}
                          </h3>
                          {special.vehicleName && (
                            <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                              {special.vehicleName}
                            </p>
                          )}

                          <p className="mt-3 text-sm leading-relaxed text-[#334155]">
                            {special.description}
                          </p>

                          <div className="mt-4 flex items-center gap-2 border-y border-[#E2E8F0] py-2.5 text-xs text-[#475569]">
                            <CalendarClock className="h-3.5 w-3.5 text-[#00437A] shrink-0" />
                            <span className="font-mono">Valid until {special.validUntil}</span>
                          </div>
                        </div>

                        <div className="mt-5">
                          {(special.offerPrice > 0 || special.monthlyFrom > 0) && (
                            <div className="flex items-baseline justify-between gap-2 mb-5">
                              {special.offerPrice > 0 && (
                                <div>
                                  <span className="block text-[11px] text-[#64748B]">
                                    Special Offer
                                  </span>
                                  <span className="font-mono text-lg font-semibold text-[#091224] tabular-nums">
                                    {formatZAR(special.offerPrice)}
                                  </span>
                                </div>
                              )}
                              {special.monthlyFrom > 0 && (
                                <div className="text-right">
                                  <span className="block text-[11px] text-[#64748B]">
                                    Instalment From
                                  </span>
                                  <span className="font-mono text-sm font-semibold text-[#00437A] tabular-nums">
                                    {formatZAR(special.monthlyFrom)} p/m
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                onBookTestDrive(
                                  special.vehicleName || special.title,
                                  special.dealershipId ?? activeDealership.id
                                )
                              }
                            >
                              Test Drive
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                onEnquireDeal({
                                  title: special.vehicleName || special.title,
                                  price: special.offerPrice || 399900,
                                  dealSummary: `${special.title} (${special.description}) · Valid until ${special.validUntil}`,
                                  homeDealershipId: special.dealershipId ?? activeDealership.id,
                                })
                              }
                            >
                              <span>Enquire</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Competitions Section */}
          {activeCompetitions.length > 0 && (
            <section className="border-t border-[#E2E8F0] pt-12">
              <SectionHeader
                kicker="Dealership Competitions"
                title="Active Promotions & Prize Draws"
                description={`Participate in live competitions running at ${activeDealership.name} and across ${groupProfile.groupName} branches.`}
              />

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                {activeCompetitions.map((comp) => (
                  <div
                    key={comp.id}
                    className="group grid grid-cols-1 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white sm:grid-cols-12 hover:shadow-lg transition-shadow"
                  >
                    <div className="sm:col-span-5 overflow-hidden bg-[#F1F5F9]">
                      <PromotionMedia
                        src={comp.imageUrl}
                        alt={comp.title}
                        mediaType={comp.mediaType}
                        hoverZoom
                        className="min-h-[200px]"
                      />
                    </div>
                    <div className="flex flex-col justify-between p-6 sm:col-span-7">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#00437A] font-semibold">
                          <span className="inline-flex items-center gap-1">
                            <Award className="h-3.5 w-3.5" />
                            Competition
                          </span>
                          <span className="font-mono text-[#64748B]">
                            Closes {comp.validUntil}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-xl font-semibold text-[#091224]">
                          {comp.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                          {comp.description}
                        </p>
                      </div>
                      <div className="mt-5">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            onEnterCompetition
                              ? onEnterCompetition(comp.title)
                              : onEnquireDeal({
                                  title: comp.title,
                                  price: 0,
                                  dealSummary: `Competition Entry: ${comp.title}`,
                                  homeDealershipId: comp.dealershipId ?? activeDealership.id,
                                })
                          }
                        >
                          <span>Enter Competition</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] pt-24 pb-20">
      <VehicleSearchShowcase
        variant="page"
        pageSize={9}
        onNavigate={onNavigate}
        onBookTestDrive={onBookTestDrive}
        onEnquireDeal={onEnquireDeal}
        onApplyFinance={onApplyFinance}
      />

      {/* MasterCars Certified Guarantee Strip */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-14 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
          <DealershipImage
            asset={MASTERCARS_HERO_ASSET}
            alt={`${activeDealership.name} MasterCars Certified Pre-Owned Standard`}
            aspectClassName="aspect-video sm:aspect-21/9"
            className="border-b border-[#E2E8F0]"
          />
          <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            {MASTERCARS_PILLARS.map((pillar) => (
              <div key={pillar.label} className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <CheckCircle2 className="h-4 w-4 text-[#00437A]" aria-hidden="true" />
                  <span>{pillar.label}</span>
                </div>
                <p className="mt-1.5 font-display text-sm font-semibold text-[#091224]">
                  {pillar.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
