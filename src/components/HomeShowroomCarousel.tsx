import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { formatZAR } from '../lib/utils';
import { AppRoute, CmsVehicle } from '../types/dealership';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { VehicleImageSlider } from './VehicleImageSlider';
import { Button } from './ui/shadcn';

interface HomeShowroomCarouselProps {
  onNavigate: (route: AppRoute) => void;
  onBookTestDrive: (vehicleName: string, homeDealershipId?: CmsVehicle['homeDealershipId']) => void;
  onEnquireVehicle: (vehicle: CmsVehicle, dealSummary?: string) => void;
}

type CarouselFilter = 'all' | 'new' | 'pre-owned';

function getItemsPerSlide(width: number): number {
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
}

export function HomeShowroomCarousel({
  onNavigate,
  onBookTestDrive,
  onEnquireVehicle,
}: HomeShowroomCarouselProps) {
  const { activeDealership, dealershipsById, activeDealerships } = useDealership();
  const { activeVehicles, activeSpecials, loadingCatalog } = useDealershipData();

  const [filter, setFilter] = useState<CarouselFilter>('all');
  const [itemsPerSlide, setItemsPerSlide] = useState<number>(() =>
    typeof window !== 'undefined' ? getItemsPerSlide(window.innerWidth) : 3
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    const onResize = () => {
      setItemsPerSlide(getItemsPerSlide(window.innerWidth));
    };
    onResize();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredVehicles = useMemo(() => {
    return activeVehicles.filter((v) => {
      if (filter === 'new') return v.category === 'New';
      if (filter === 'pre-owned') return v.category !== 'New';
      return true;
    });
  }, [activeVehicles, filter]);

  const totalSlides = Math.max(1, Math.ceil(filteredVehicles.length / itemsPerSlide));
  const safeSlideIndex = Math.min(slideIndex, totalSlides - 1);

  useEffect(() => {
    setSlideIndex(0);
  }, [filter, itemsPerSlide]);

  const currentSlideItems = useMemo(() => {
    const start = safeSlideIndex * itemsPerSlide;
    return filteredVehicles.slice(start, start + itemsPerSlide);
  }, [filteredVehicles, safeSlideIndex, itemsPerSlide]);

  const handlePrev = () => {
    setDirection(-1);
    setSlideIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNext = () => {
    setDirection(1);
    setSlideIndex((prev) => (prev + 1) % totalSlides);
  };

  return (
    <section
      id="featured-showroom"
      aria-labelledby="featured-showroom-heading"
      className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            kicker="Master Group Showroom Spotlight"
            title={`Available Volkswagen Group Stock`}
            description={`Browse live New, MasterCars, and Used stock shared across ${activeDealerships.map((b) => b.city).join(', ')}—and enquire directly through ${activeDealership.shortName}.`}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1"
              role="group"
              aria-label="Filter showroom carousel"
            >
              {[
                { key: 'all' as const, label: 'All Group Stock' },
                { key: 'new' as const, label: 'New Cars' },
                { key: 'pre-owned' as const, label: 'MasterCars & Used' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === tab.key
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {totalSlides > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous vehicles slide"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="px-2 font-mono text-xs font-medium text-[#475569] tabular-nums">
                  {safeSlideIndex + 1} / {totalSlides}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next vehicles slide"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Responsive Carousel Viewport: 3 on desktop, 2 on tablet, 1 on mobile */}
        <div className="mt-8 overflow-hidden">
          {loadingCatalog && filteredVehicles.length === 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: itemsPerSlide }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[420px] rounded-xl border border-[#E2E8F0] bg-white animate-pulse"
                />
              ))}
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
              <p className="text-base font-medium text-[#091224]">
                {activeVehicles.length === 0
                  ? 'No vehicles are currently listed in Group Showroom.'
                  : 'No vehicles listed in this category yet.'}
              </p>
              <p className="mt-1.5 text-sm text-[#64748B]">
                {activeVehicles.length === 0
                  ? 'Live AutoTrader stock and new dealership entries will appear here automatically once synced.'
                  : 'Try switching categories or view the complete dealership stock.'}
              </p>
              {filter !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilter('all')}
                >
                  Show All Group Stock
                </Button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${filter}-${safeSlideIndex}-${itemsPerSlide}`}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
              >
                {currentSlideItems.map((vehicle, idx) => {
                  const homeBranch = dealershipsById[vehicle.homeDealershipId] ?? activeDealership;
                  const matchingSpecial = activeSpecials.find(
                    (sp) =>
                      sp.vehicleName &&
                      (sp.vehicleName.toLowerCase().includes(vehicle.model.toLowerCase()) ||
                        vehicle.title.toLowerCase().includes(sp.vehicleName.toLowerCase()))
                  );

                  return (
                    <article
                      key={vehicle.id}
                      id={idx === 0 ? 'featured-showroom-heading' : undefined}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
                    >
                      <VehicleImageSlider
                        images={vehicle.images}
                        alt={`${vehicle.title} — ${vehicle.model}`}
                        badge={
                          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#001E50] shadow-xs backdrop-blur-xs">
                            <MapPin className="h-3 w-3 text-[#00437A]" />
                            <span>Held at {homeBranch.shortName}</span>
                          </div>
                        }
                      />

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                            <span>
                              {vehicle.category} · {vehicle.year} ·{' '}
                              {vehicle.mileage === 0
                                ? '0 km'
                                : `${vehicle.mileage.toLocaleString('en-ZA')} km`}
                            </span>
                            {matchingSpecial ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#00437A]">
                                <Sparkles className="h-3 w-3" />
                                Active Special
                              </span>
                            ) : (
                              <span className="font-mono text-[#00437A]">{homeBranch.city}</span>
                            )}
                          </div>

                          <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-[#091224]">
                            {vehicle.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#64748B]">
                            {vehicle.model}
                            {vehicle.colour ? ` · ${vehicle.colour}` : ''}
                          </p>

                          {matchingSpecial && (
                            <p className="mt-2.5 text-xs font-medium text-[#001E50]">
                              {matchingSpecial.description}
                            </p>
                          )}

                          <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-[#E2E8F0] py-3 text-xs">
                            <div>
                              <dt className="text-[#64748B]">Gearbox</dt>
                              <dd className="mt-0.5 font-medium text-[#091224] truncate">
                                {vehicle.transmission}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[#64748B]">Fuel</dt>
                              <dd className="mt-0.5 font-medium text-[#091224] truncate">
                                {vehicle.fuelType}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="mt-5">
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <span className="block text-[11px] text-[#64748B]">
                                {vehicle.category === 'New' ? 'From Retail' : 'Selling Price'}
                              </span>
                              <span className="font-mono text-lg font-semibold text-[#091224] tabular-nums">
                                {formatZAR(vehicle.price)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-[11px] text-[#64748B]">Est. Finance</span>
                              <span className="font-mono text-sm font-semibold text-[#00437A] tabular-nums">
                                From {formatZAR(vehicle.monthlyFrom)} p/m
                              </span>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-2.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                onBookTestDrive(vehicle.title, vehicle.homeDealershipId)
                              }
                            >
                              Test Drive
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                onEnquireVehicle(vehicle, matchingSpecial?.description)
                              }
                            >
                              <span>Enquire</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Slide Dots + Bottom View More Showroom CTA */}
        <FadeUp delay={0.08} className="mt-10 flex flex-col items-center gap-5">
          {totalSlides > 1 && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Showroom slide pages">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === safeSlideIndex}
                  aria-label={`View slide ${idx + 1}`}
                  onClick={() => {
                    setDirection(idx > safeSlideIndex ? 1 : -1);
                    setSlideIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                    idx === safeSlideIndex
                      ? 'w-8 bg-[#001E50]'
                      : 'w-2 bg-[#CBD5E1] hover:bg-[#94A3B8]'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="lg" onClick={() => onNavigate('/vehicles')}>
              <span>View All {activeVehicles.length} Vehicles in Group Showroom</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            {activeSpecials.length > 0 && (
              <Button variant="outline" size="lg" onClick={() => onNavigate('/specials')}>
                <span>View {activeSpecials.length} Active Specials</span>
              </Button>
            )}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
