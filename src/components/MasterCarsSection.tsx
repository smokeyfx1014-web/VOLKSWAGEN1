import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { MASTERCARS_HERO_ASSET, MASTERCARS_LISTINGS } from '../data/dealershipData';
import { formatZAR } from '../lib/utils';
import { MasterCarListing } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button } from './ui/shadcn';

interface MasterCarsSectionProps {
  onInquireVehicle: (listing: MasterCarListing) => void;
  onViewAllMasterCars: () => void;
}

const PILLARS = [
  { label: 'Age & Mileage Cap', value: 'Under 5 Years · < 120,000 km' },
  { label: 'Technical Audit', value: '80-Point Workshop Inspection' },
  { label: 'Buyer Protection', value: '7-Day / 1,000 km Exchange Policy' },
  { label: 'Peace of Mind', value: '12-Month Certification & VW Alert' },
];

export function MasterCarsSection({
  onInquireVehicle,
  onViewAllMasterCars,
}: MasterCarsSectionProps) {
  const [bodyFilter, setBodyFilter] = useState<'All' | 'Hatchback' | 'SUV' | 'Commercial'>('All');

  const filtered = MASTERCARS_LISTINGS.filter(
    (item) => bodyFilter === 'All' || item.bodyType === bodyFilter
  );

  return (
    <section
      id="mastercars"
      aria-labelledby="mastercars-heading"
      className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            kicker="MasterCars · Certified Pre-Owned"
            title="Pre-owned Volkswagens held to factory standards"
            description="Every MasterCar on our Newcastle floor passes an uncompromising 80-point mechanical and provenance check backed by Volkswagen South Africa."
          />

          <FadeUp delay={0.08}>
            <Button variant="outline" size="lg" onClick={onViewAllMasterCars}>
              <span>Request Full Stock Sheet</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </FadeUp>
        </div>

        {/* Large MasterCars Showcase Banner */}
        <FadeUp className="mt-10 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
          <DealershipImage
            asset={MASTERCARS_HERO_ASSET}
            alt="Newcastle Volkswagen MasterCars Certified Pre-Owned Showroom"
            aspectClassName="aspect-video sm:aspect-21/9"
            className="border-b border-[#E2E8F0]"
          />

          {/* 4-Column Guarantee Strip */}
          <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.label} className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                  <CheckCircle2 className="h-4 w-4 text-[#00437A]" aria-hidden="true" />
                  <span>{pillar.label}</span>
                </div>
                <p
                  id={pillar.label === 'Age & Mileage Cap' ? 'mastercars-heading' : undefined}
                  className="mt-1.5 font-display text-sm font-semibold text-[#091224]"
                >
                  {pillar.value}
                </p>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* Body Type Filter Bar */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1">
            {(['All', 'Hatchback', 'SUV', 'Commercial'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBodyFilter(type)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  bodyFilter === type
                    ? 'bg-[#001E50] text-white'
                    : 'text-[#475569] hover:text-[#091224]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-xs font-mono text-[#64748B] tabular-nums">
            {filtered.length} certified vehicles featured
          </p>
        </div>

        {/* Certified Inventory Cards */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {filtered.map((car, idx) => (
            <FadeUp key={car.id} delay={idx * 0.06}>
              <motion.article
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
              >
                <DealershipImage
                  asset={car.asset}
                  alt={car.title}
                  className="border-b border-[#E2E8F0]"
                />

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#475569]">
                      <span className="font-semibold text-[#00437A]">MasterCars Certified</span>
                      <span aria-hidden="true">·</span>
                      <span>{car.year}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {car.mileageKm.toLocaleString('en-ZA')} km
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-[#091224]">
                      {car.title}
                    </h3>

                    <p className="mt-2 text-xs text-[#475569]">
                      {car.transmission} · {car.fuelType} · {car.colour}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-lg font-semibold text-[#091224] tabular-nums">
                        {formatZAR(car.price)}
                      </span>
                      <span className="font-mono text-xs font-medium text-[#00437A] tabular-nums">
                        Est. {formatZAR(car.monthlyEstimate)} p/m
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => onInquireVehicle(car)}
                    >
                      <span>Enquire About Vehicle</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.article>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
