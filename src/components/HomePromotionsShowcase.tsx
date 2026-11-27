import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Award, Banknote, Calendar, MapPin, Sparkles } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { formatZAR } from '../lib/utils';
import { AppRoute, CmsPromotion, DealershipId } from '../types/dealership';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { PromotionMedia } from './PromotionMedia';
import { Button } from './ui/shadcn';

interface HomePromotionsShowcaseProps {
  onNavigate: (route: AppRoute) => void;
  onEnterCompetition: (competitionTitle: string, homeDealershipId: DealershipId | null) => void;
  onEnquireDeal: (item: {
    title: string;
    price: number;
    dealSummary: string;
    homeDealershipId: DealershipId | null;
  }) => void;
  onBookTestDrive: (vehicleName: string, homeDealershipId: DealershipId | null) => void;
}

export function HomePromotionsShowcase({
  onNavigate,
  onEnterCompetition,
  onEnquireDeal,
  onBookTestDrive,
}: HomePromotionsShowcaseProps) {
  const { activeDealership, dealershipsById, groupProfile } = useDealership();
  const { activeCompetitions, activeSpecials } = useDealershipData();

  // Prioritize prize draws & spotter promotions alongside top active showroom specials
  const featuredItems: CmsPromotion[] = [
    ...activeCompetitions,
    ...activeSpecials,
  ].slice(0, 4);

  if (featuredItems.length === 0) return null;

  return (
    <section
      aria-labelledby="home-promotions-heading"
      className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            kicker={`${groupProfile.groupName} Rewards, Spotters & Offers`}
            title="Active Promotions & Prize Draws"
            description={`Explore current referral rewards, prize draws, and ${activeDealership.shortName} vehicle specials running across our dealerships.`}
          />
          <Button
            variant="outline"
            onClick={() => onNavigate('/specials')}
            className="shrink-0 bg-white"
          >
            <span>View All Specials &amp; Draws</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {featuredItems.map((promo, index) => {
            const isCompetition = promo.type === 'competition';
            const isSpotterPromo =
              isCompetition &&
              (promo.title.toLowerCase().includes('spotter') ||
                promo.description.toLowerCase().includes('spotter'));
            const branchLabel =
              promo.scope === 'MASTER'
                ? `All ${groupProfile.groupName} Branches`
                : dealershipsById[promo.dealershipId ?? activeDealership.id]?.shortName ??
                  activeDealership.shortName;

            return (
              <FadeUp key={promo.id} delay={(index % 2) * 0.05}>
                <motion.article
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="group grid h-full grid-cols-1 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-shadow hover:shadow-lg sm:grid-cols-12"
                >
                  <div className="relative sm:col-span-5 overflow-hidden bg-[#0F172A]">
                    <PromotionMedia
                      src={promo.imageUrl}
                      alt={promo.title}
                      mediaType={promo.mediaType}
                      hoverZoom
                      className="min-h-[210px]"
                    />
                    <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span
                        className={
                          isSpotterPromo
                            ? 'inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow'
                            : isCompetition
                            ? 'inline-flex items-center gap-1 rounded-md bg-[#001E50] px-2.5 py-1 text-[11px] font-semibold text-white shadow'
                            : 'inline-flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#001E50] shadow'
                        }
                      >
                        {isSpotterPromo ? (
                          <>
                            <Banknote className="h-3.5 w-3.5" />
                            <span>Spotter Reward</span>
                          </>
                        ) : isCompetition ? (
                          <>
                            <Award className="h-3.5 w-3.5" />
                            <span>Prize Draw</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Special Offer</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between p-5 sm:p-6 sm:col-span-7">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-[#64748B]">
                        <span className="inline-flex items-center gap-1 text-[#00437A] font-semibold">
                          <MapPin className="h-3 w-3" />
                          <span>{branchLabel}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          <span>Valid until {promo.validUntil}</span>
                        </span>
                      </div>

                      <h3
                        id={index === 0 ? 'home-promotions-heading' : undefined}
                        className="mt-2 font-display text-lg font-semibold leading-snug text-[#091224]"
                      >
                        {promo.title}
                      </h3>

                      <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#475569] line-clamp-3">
                        {promo.description}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        {isCompetition && promo.offerPrice > 0 ? (
                          <p className="font-mono text-sm font-semibold text-emerald-700">
                            Earn {formatZAR(promo.offerPrice)} per vehicle sold
                          </p>
                        ) : promo.monthlyFrom > 0 ? (
                          <p className="font-mono text-sm font-semibold text-[#001E50]">
                            From {formatZAR(promo.monthlyFrom)} p/m
                          </p>
                        ) : promo.offerPrice > 0 ? (
                          <p className="font-mono text-sm font-semibold text-[#001E50]">
                            {formatZAR(promo.offerPrice)}
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-[#00437A]">
                            {promo.eventTime || promo.location || 'Limited-time dealership offer'}
                          </p>
                        )}
                      </div>

                      {isCompetition ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            onEnterCompetition(
                              promo.title,
                              promo.dealershipId ?? activeDealership.id
                            )
                          }
                        >
                          <span>
                            {isSpotterPromo ? 'Submit Spotter Referral Lead' : 'Enter Prize Draw'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              onBookTestDrive(
                                promo.vehicleName || promo.title,
                                promo.dealershipId ?? activeDealership.id
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
                                title: promo.vehicleName || promo.title,
                                price: promo.offerPrice || 399900,
                                dealSummary: `${promo.title} (${promo.description}) · Valid until ${promo.validUntil}`,
                                homeDealershipId: promo.dealershipId ?? activeDealership.id,
                              })
                            }
                          >
                            <span>Enquire</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.article>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
