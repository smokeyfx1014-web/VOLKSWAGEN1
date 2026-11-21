import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { MASTERCARS_LISTINGS, VEHICLE_MODELS } from '../data/dealership';
import { formatZAR } from '../lib/utils';
import { StockCondition, VehicleCategory } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button, Label, Select } from './ui/shadcn';

interface UnifiedInventoryItem {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<VehicleCategory, 'All'>;
  condition: Exclude<StockCondition, 'All'>;
  year: number;
  mileageKm: number;
  price: number;
  monthlyFrom: number;
  transmission: string;
  inStock: boolean;
  isSpecial: boolean;
  specialSummary?: string;
  validUntil?: string;
  asset: (typeof VEHICLE_MODELS)[number]['asset'];
}

interface ShowroomInventoryViewProps {
  mode: 'vehicles' | 'specials';
  onBookTestDrive: (vehicleName: string) => void;
  onEnquireDeal: (item: { title: string; price: number; dealSummary?: string }) => void;
}

export function ShowroomInventoryView({
  mode,
  onBookTestDrive,
  onEnquireDeal,
}: ShowroomInventoryViewProps) {
  const [condition, setCondition] = useState<StockCondition>('All');
  const [category, setCategory] = useState<VehicleCategory>('All');
  const [maxPrice, setMaxPrice] = useState<number>(1000000);
  const [maxMonthly, setMaxMonthly] = useState<number>(15000);

  const unifiedItems = useMemo<UnifiedInventoryItem[]>(() => {
    const baseModels: UnifiedInventoryItem[] = VEHICLE_MODELS.map((m) => ({
      id: m.id,
      title: m.name,
      subtitle: m.variant,
      category: m.category,
      condition: m.condition,
      year: m.year,
      mileageKm: m.mileageKm,
      price: m.priceFrom,
      monthlyFrom: m.monthlyFrom,
      transmission: m.transmission,
      inStock: m.inStock,
      isSpecial: m.isSpecial,
      specialSummary: m.specialOfferSummary,
      validUntil: m.specialValidUntil,
      asset: m.asset,
    }));

    const usedItems: UnifiedInventoryItem[] = MASTERCARS_LISTINGS.map((mc) => ({
      id: mc.id,
      title: mc.title,
      subtitle: `${mc.transmission} · ${mc.fuelType} · ${mc.colour}`,
      category:
        mc.bodyType === 'Hatchback'
          ? 'Hatchbacks & Sedans'
          : mc.bodyType === 'SUV'
          ? 'SUVs'
          : 'Commercial',
      condition: mc.condition,
      year: mc.year,
      mileageKm: mc.mileageKm,
      price: mc.price,
      monthlyFrom: mc.monthlyEstimate,
      transmission: mc.transmission,
      inStock: true,
      isSpecial: false,
      asset: mc.asset,
    }));

    return [...baseModels, ...usedItems];
  }, []);

  const filtered = unifiedItems.filter((item) => {
    if (mode === 'specials' && !item.isSpecial) return false;
    if (condition !== 'All' && item.condition !== condition) return false;
    if (category !== 'All' && item.category !== category) return false;
    if (item.price > maxPrice) return false;
    if (item.monthlyFrom > maxMonthly) return false;
    return true;
  });

  return (
    <div className="bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker={mode === 'specials' ? 'Monthly Specials' : 'Unified Showroom'}
          title={
            mode === 'specials'
              ? 'Current Newcastle Volkswagen & Financial Services Deals'
              : 'Browse New, MasterCars & Demo Inventory'
          }
          description={
            mode === 'specials'
              ? 'Featured November 2026 showroom offers across Polo Vivo, Polo Hatch, T-Cross, Amarok, and Transporter. Click Enquire on Deal to pre-fill your quote.'
              : 'Filter across new Volkswagen models, certified pre-owned MasterCars, and low-mileage demonstration units by body type, cash price, and monthly budget.'
          }
        />

        {/* Filter Controls */}
        <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mode !== 'specials' && (
              <div>
                <Label htmlFor="inv-condition">Stock Type</Label>
                <Select
                  id="inv-condition"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as StockCondition)}
                >
                  <option value="All">All Stock (New, MasterCars, Demo)</option>
                  <option value="New">New Vehicles</option>
                  <option value="MasterCars">Certified MasterCars</option>
                  <option value="Demo">Demo Vehicles</option>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="inv-category">Body Type</Label>
              <Select
                id="inv-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCategory)}
              >
                <option value="All">All Body Types</option>
                <option value="Hatchbacks & Sedans">Hatchbacks & Sedans</option>
                <option value="SUVs">SUVs & Crossovers</option>
                <option value="Commercial">Commercial & Bakkies</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="inv-price">Max Price ({formatZAR(maxPrice)})</Label>
              <Select
                id="inv-price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              >
                <option value={450000}>Up to R 450 000</option>
                <option value={650000}>Up to R 650 000</option>
                <option value={850000}>Up to R 850 000</option>
                <option value={1000000}>All Prices</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="inv-monthly">Max Monthly ({formatZAR(maxMonthly)} p/m)</Label>
              <Select
                id="inv-monthly"
                value={maxMonthly}
                onChange={(e) => setMaxMonthly(Number(e.target.value))}
              >
                <option value={4500}>Up to R 4 500 p/m</option>
                <option value={7500}>Up to R 7 500 p/m</option>
                <option value={11000}>Up to R 11 000 p/m</option>
                <option value={15000}>All Monthly Instalments</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center">
            <p className="text-base font-medium text-[#091224]">
              No vehicles match your selected budget or category filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setCondition('All');
                setCategory('All');
                setMaxPrice(1000000);
                setMaxMonthly(15000);
              }}
            >
              Reset All Filters
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item, idx) => (
              <FadeUp key={item.id} delay={(idx % 3) * 0.05}>
                <motion.article
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white hover:shadow-lg transition-shadow"
                >
                  <DealershipImage
                    asset={item.asset}
                    alt={item.title}
                    className="border-b border-[#E2E8F0]"
                  />

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-[#475569]">
                        <span>
                          {item.condition} · {item.year} ·{' '}
                          {item.mileageKm === 0
                            ? '0 km'
                            : `${item.mileageKm.toLocaleString('en-ZA')} km`}
                        </span>
                        {item.isSpecial && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#00437A]">
                            <Sparkles className="h-3 w-3" />
                            <span>Deal</span>
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-[#091224]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-[#475569]">{item.subtitle}</p>

                      {item.specialSummary && (
                        <p className="mt-3 text-xs font-medium text-[#001E50]">
                          {item.specialSummary}
                        </p>
                      )}
                      {item.validUntil && mode === 'specials' && (
                        <p className="mt-1 text-[11px] font-mono text-[#64748B]">
                          Valid until {item.validUntil} · T&Cs apply
                        </p>
                      )}
                    </div>

                    <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="block text-[11px] text-[#64748B]">Retail Price</span>
                          <span className="font-mono text-lg font-semibold text-[#091224] tabular-nums">
                            {formatZAR(item.price)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] text-[#64748B]">Monthly From</span>
                          <span className="font-mono text-sm font-semibold text-[#00437A] tabular-nums">
                            {formatZAR(item.monthlyFrom)} p/m
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onBookTestDrive(item.title)}
                        >
                          Test Drive
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            onEnquireDeal({
                              title: item.title,
                              price: item.price,
                              dealSummary: item.specialSummary,
                            })
                          }
                        >
                          <span>{mode === 'specials' ? 'Enquire on Deal' : 'Enquire'}</span>
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
    </div>
  );
}
