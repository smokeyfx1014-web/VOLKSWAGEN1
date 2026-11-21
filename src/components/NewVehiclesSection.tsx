import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { VEHICLE_MODELS } from '../data/dealershipData';
import { formatZAR } from '../lib/utils';
import { VehicleCategory, VehicleModel } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button } from './ui/shadcn';

export type InventoryFilterMode = 'all' | 'in-stock' | 'specials';

interface NewVehiclesSectionProps {
  activeCategory: VehicleCategory;
  onCategoryChange: (cat: VehicleCategory) => void;
  filterMode: InventoryFilterMode;
  onFilterModeChange: (mode: InventoryFilterMode) => void;
  onBookTestDrive: (vehicleName: string) => void;
  onRequestQuote: (vehicle: VehicleModel) => void;
}

const CATEGORIES: VehicleCategory[] = [
  'All',
  'Hatchbacks & Sedans',
  'SUVs',
  'Commercial',
];

export function NewVehiclesSection({
  activeCategory,
  onCategoryChange,
  filterMode,
  onFilterModeChange,
  onBookTestDrive,
  onRequestQuote,
}: NewVehiclesSectionProps) {
  const filteredVehicles = VEHICLE_MODELS.filter((v) => {
    const matchesCategory = activeCategory === 'All' || v.category === activeCategory;
    const matchesMode =
      filterMode === 'all' ||
      (filterMode === 'in-stock' && v.inStock) ||
      (filterMode === 'specials' && v.isSpecial);
    return matchesCategory && matchesMode;
  });

  return (
    <section
      id="new-vehicles"
      aria-labelledby="new-vehicles-title"
      className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            kicker="New Vehicles & Monthly Specials"
            title="Engineered for South African roads"
            description="Explore current passenger and commercial Volkswagen models available at Newcastle Volkswagen, complete with transparent Rand pricing and monthly showroom specials."
          />

          {/* Quick Inventory Mode Toggle */}
          <div
            className="inline-flex w-fit items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white p-1"
            role="group"
            aria-label="Filter vehicle availability"
          >
            <button
              type="button"
              onClick={() => onFilterModeChange('all')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-[#001E50] text-white'
                  : 'text-[#475569] hover:text-[#091224]'
              }`}
            >
              Full Range
            </button>
            <button
              type="button"
              onClick={() => onFilterModeChange('in-stock')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'in-stock'
                  ? 'bg-[#001E50] text-white'
                  : 'text-[#475569] hover:text-[#091224]'
              }`}
            >
              In Stock Now
            </button>
            <button
              type="button"
              onClick={() => onFilterModeChange('specials')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterMode === 'specials'
                  ? 'bg-[#001E50] text-white'
                  : 'text-[#475569] hover:text-[#091224]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Monthly Specials</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div
          className="mt-8 flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] pb-4"
          role="tablist"
          aria-label="Vehicle body category"
        >
          {CATEGORIES.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(category)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#001E50] border border-[#001E50]/25 shadow-xs'
                    : 'text-[#475569] hover:text-[#091224] hover:bg-white/70 border border-transparent'
                }`}
              >
                {category}
              </button>
            );
          })}
          <span className="ml-auto text-xs font-mono text-[#64748B] tabular-nums">
            Showing {filteredVehicles.length} of {VEHICLE_MODELS.length} models
          </span>
        </div>

        {/* Vehicle Showroom Grid */}
        {filteredVehicles.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
            <p className="text-base font-medium text-[#091224]">
              No models match the selected category and availability filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                onCategoryChange('All');
                onFilterModeChange('all');
              }}
            >
              Reset Showroom Filters
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredVehicles.map((vehicle, index) => (
              <FadeUp key={vehicle.id} delay={(index % 3) * 0.06}>
                <motion.article
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
                >
                  <DealershipImage
                    asset={vehicle.asset}
                    alt={`${vehicle.name} — ${vehicle.variant}`}
                    className="border-b border-[#E2E8F0]"
                  />

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                        <span>
                          {vehicle.category} · {vehicle.inStock ? 'In Stock' : 'Order Available'}
                        </span>
                        {vehicle.isSpecial && (
                          <span className="font-semibold text-[#00437A]">Special Offer</span>
                        )}
                      </div>

                      <h3
                        id={index === 0 ? 'new-vehicles-title' : undefined}
                        className="mt-2 font-display text-xl font-semibold tracking-tight text-[#091224]"
                      >
                        {vehicle.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-[#475569]">{vehicle.variant}</p>

                      {vehicle.specialOfferSummary && (
                        <div className="mt-3 space-y-0.5">
                          <p className="text-xs font-medium text-[#001E50]">
                            {vehicle.specialOfferSummary}
                          </p>
                          {vehicle.specialValidUntil && (
                            <p className="text-[11px] font-mono text-[#64748B]">
                              Valid until {vehicle.specialValidUntil} · T&amp;Cs apply
                            </p>
                          )}
                        </div>
                      )}

                      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-[#E2E8F0] py-3 text-xs">
                        <div>
                          <dt className="text-[#64748B]">Output</dt>
                          <dd className="mt-0.5 font-mono font-medium text-[#091224] tabular-nums">
                            {vehicle.powerKw}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[#64748B]">Gearbox</dt>
                          <dd className="mt-0.5 font-medium text-[#091224] truncate">
                            {vehicle.transmission}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[#64748B]">Economy</dt>
                          <dd className="mt-0.5 font-mono font-medium text-[#091224] tabular-nums">
                            {vehicle.fuelEconomy}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="block text-[11px] text-[#64748B]">Recommended Retail</span>
                          <span className="font-mono text-lg font-semibold text-[#091224] tabular-nums">
                            {formatZAR(vehicle.priceFrom)}
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
                          onClick={() => onBookTestDrive(vehicle.name)}
                        >
                          Test Drive
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          onClick={() => onRequestQuote(vehicle)}
                        >
                          <span>Enquire</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              </FadeUp>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
