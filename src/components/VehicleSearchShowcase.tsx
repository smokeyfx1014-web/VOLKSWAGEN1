import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { formatZAR, toTelHref } from '../lib/utils';
import {
  AppRoute,
  CmsVehicle,
  DealershipId,
  StockCondition,
  VehicleCategory,
} from '../types/dealership';
import { VehicleImageSlider } from './VehicleImageSlider';
import { Button, Dialog, Input, Select } from './ui/shadcn';

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'mileage-asc' | 'year-desc';
type MileageRange =
  | 'all'
  | 'under-1000'
  | 'under-15000'
  | 'under-50000'
  | 'under-100000'
  | 'under-150000'
  | 'over-150000';
type FuelFilter = 'All' | 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';

interface VehicleSearchShowcaseProps {
  variant?: 'home' | 'page';
  pageSize?: number;
  onNavigate?: (route: AppRoute) => void;
  onBookTestDrive: (vehicleName: string, homeDealershipId?: DealershipId | null) => void;
  onEnquireDeal: (item: {
    title: string;
    price: number;
    dealSummary?: string;
    homeDealershipId?: DealershipId | null;
  }) => void;
  onApplyFinance?: (vehicle: CmsVehicle) => void;
}

const PRICE_OPTIONS = [
  100000, 150000, 200000, 250000, 300000, 400000, 500000, 650000, 800000, 1000000, 1500000, 2500000,
];
const MONTHLY_OPTIONS = [
  2000, 3000, 4000, 5000, 6500, 8000, 10000, 12500, 15000, 20000, 30000, 40000,
];

function matchesTransmission(rawTransmission: string, filter: string): boolean {
  if (filter === 'All') return true;
  const lower = rawTransmission.toLowerCase();
  if (filter === 'Automatic') {
    return /auto|dsg|tiptronic|cvt|s-tronic|dct/i.test(lower);
  }
  if (filter === 'Manual') {
    return /manual|\bmt\b/i.test(lower) || !/auto|dsg|tiptronic|cvt|s-tronic|dct/i.test(lower);
  }
  return lower === filter.toLowerCase();
}

function matchesMileage(km: number, range: MileageRange): boolean {
  switch (range) {
    case 'under-1000':
      return km <= 1000;
    case 'under-15000':
      return km <= 15000;
    case 'under-50000':
      return km <= 50000;
    case 'under-100000':
      return km <= 100000;
    case 'under-150000':
      return km <= 150000;
    case 'over-150000':
      return km > 150000;
    case 'all':
    default:
      return true;
  }
}

function matchesFuel(rawFuel: string, filter: FuelFilter): boolean {
  if (filter === 'All') return true;
  const lower = rawFuel.toLowerCase();
  if (filter === 'Hybrid') {
    return lower.includes('hybrid') || lower.includes('phev');
  }
  if (filter === 'Electric') {
    return (
      (lower.includes('electric') || lower === 'ev' || lower.includes('bev')) &&
      !lower.includes('hybrid')
    );
  }
  return lower.includes(filter.toLowerCase());
}

export function VehicleSearchShowcase({
  variant = 'page',
  pageSize = 9,
  onNavigate,
  onBookTestDrive,
  onEnquireDeal,
  onApplyFinance,
}: VehicleSearchShowcaseProps) {
  const { activeDealership, activeDealerships, dealershipsById, groupProfile } = useDealership();
  const { activeVehicles, activeSpecials, loadingCatalog } = useDealershipData();

  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [showSpecialsOnly, setShowSpecialsOnly] = useState(false);
  const [makeModelFilter, setMakeModelFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState<'All' | DealershipId>('All');
  const [conditionFilter, setConditionFilter] = useState<StockCondition>('All');
  const [bodyTypeFilter, setBodyTypeFilter] = useState<VehicleCategory>('All');
  const [transmissionFilter, setTransmissionFilter] = useState('All');
  const [mileageFilter, setMileageFilter] = useState<MileageRange>('all');
  const [yearFilter, setYearFilter] = useState('All');
  const [fuelFilter, setFuelFilter] = useState<FuelFilter>('All');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [minMonthly, setMinMonthly] = useState<number>(0);
  const [maxMonthly, setMaxMonthly] = useState<number>(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [quickViewVehicle, setQuickViewVehicle] = useState<CmsVehicle | null>(null);

  const makeModelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of activeVehicles) {
      const label = `${v.make || 'Volkswagen'} ${v.model || ''}`.trim();
      if (label) set.add(label);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeVehicles]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    for (const v of activeVehicles) {
      if (v.year) set.add(v.year);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [activeVehicles]);

  const specialMatchedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of activeVehicles) {
      const hit = activeSpecials.some(
        (sp) =>
          sp.vehicleName &&
          (sp.vehicleName.toLowerCase().includes(v.model.toLowerCase()) ||
            v.title.toLowerCase().includes(sp.vehicleName.toLowerCase()))
      );
      if (hit) ids.add(v.id);
    }
    return ids;
  }, [activeVehicles, activeSpecials]);

  const filteredVehicles = useMemo(() => {
    const queryText = appliedSearch.trim().toLowerCase();

    const list = activeVehicles.filter((item) => {
      if (showSpecialsOnly && !specialMatchedIds.has(item.id)) return false;

      if (makeModelFilter !== 'All') {
        const makeModel = `${item.make || 'Volkswagen'} ${item.model || ''}`.trim();
        if (makeModel !== makeModelFilter) return false;
      }

      if (branchFilter !== 'All' && item.homeDealershipId !== branchFilter) return false;
      if (conditionFilter !== 'All' && item.category !== conditionFilter) return false;
      if (bodyTypeFilter !== 'All' && item.bodyStyle !== bodyTypeFilter) return false;
      if (!matchesTransmission(item.transmission || '', transmissionFilter)) return false;
      if (!matchesMileage(Number(item.mileage || 0), mileageFilter)) return false;
      if (yearFilter !== 'All' && String(item.year) !== yearFilter) return false;
      if (!matchesFuel(item.fuelType || '', fuelFilter)) return false;

      if (minPrice > 0 && item.price < minPrice) return false;
      if (maxPrice > 0 && item.price > maxPrice) return false;
      if (minMonthly > 0 && item.monthlyFrom < minMonthly) return false;
      if (maxMonthly > 0 && item.monthlyFrom > maxMonthly) return false;

      if (queryText) {
        const branchName = dealershipsById[item.homeDealershipId]?.name ?? '';
        const haystack = [
          item.title,
          item.make,
          item.model,
          item.variant ?? '',
          String(item.year),
          item.category,
          item.bodyStyle,
          item.fuelType,
          item.transmission,
          item.colour,
          branchName,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(queryText)) return false;
      }

      return true;
    });

    const sorted = [...list];
    switch (sortBy) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'mileage-asc':
        sorted.sort((a, b) => a.mileage - b.mileage);
        break;
      case 'year-desc':
        sorted.sort((a, b) => b.year - a.year || a.price - b.price);
        break;
      case 'featured':
      default:
        break;
    }

    return sorted;
  }, [
    activeVehicles,
    appliedSearch,
    showSpecialsOnly,
    specialMatchedIds,
    makeModelFilter,
    branchFilter,
    conditionFilter,
    bodyTypeFilter,
    transmissionFilter,
    mileageFilter,
    yearFilter,
    fuelFilter,
    minPrice,
    maxPrice,
    minMonthly,
    maxMonthly,
    sortBy,
    dealershipsById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    appliedSearch,
    showSpecialsOnly,
    makeModelFilter,
    branchFilter,
    conditionFilter,
    bodyTypeFilter,
    transmissionFilter,
    mileageFilter,
    yearFilter,
    fuelFilter,
    minPrice,
    maxPrice,
    minMonthly,
    maxMonthly,
    sortBy,
  ]);

  const paginatedVehicles = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredVehicles.slice(start, start + pageSize);
  }, [filteredVehicles, safePage, pageSize]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    if (safePage > 3) pages.push('ellipsis');
    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    if (safePage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }, [totalPages, safePage]);

  const hasActiveFilters = Boolean(
    appliedSearch ||
      searchInput ||
      showSpecialsOnly ||
      makeModelFilter !== 'All' ||
      branchFilter !== 'All' ||
      conditionFilter !== 'All' ||
      bodyTypeFilter !== 'All' ||
      transmissionFilter !== 'All' ||
      mileageFilter !== 'all' ||
      yearFilter !== 'All' ||
      fuelFilter !== 'All' ||
      minPrice > 0 ||
      maxPrice > 0 ||
      minMonthly > 0 ||
      maxMonthly > 0
  );

  const resetFilters = () => {
    setSortBy('featured');
    setSearchInput('');
    setAppliedSearch('');
    setShowSpecialsOnly(false);
    setMakeModelFilter('All');
    setBranchFilter('All');
    setConditionFilter('All');
    setBodyTypeFilter('All');
    setTransmissionFilter('All');
    setMileageFilter('all');
    setYearFilter('All');
    setFuelFilter('All');
    setMinPrice(0);
    setMaxPrice(0);
    setMinMonthly(0);
    setMaxMonthly(0);
    setCurrentPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
  };

  const filterSidebarContent = (
    <div className="space-y-3.5">
      <div className="border-b border-[#E2E8F0] pb-3.5 text-center">
        <h3 className="font-display text-lg font-semibold text-[#001E50]">Search Filter</h3>
        <p className="mt-1 font-mono text-xs text-[#475569] tabular-nums">
          <strong className="text-[#091224]">{filteredVehicles.length}</strong>{' '}
          {filteredVehicles.length === 1 ? 'result' : 'results'} found
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#00437A] hover:text-[#001E50] underline underline-offset-2 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset all filters</span>
          </button>
        )}
      </div>

      <label className="flex items-center gap-2.5 text-xs font-medium text-[#334155] cursor-pointer py-1">
        <input
          type="checkbox"
          checked={showSpecialsOnly}
          onChange={(e) => setShowSpecialsOnly(e.target.checked)}
          className="h-4 w-4 rounded border-[#CBD5E1] accent-[#001E50]"
        />
        <span>
          Show Specials{' '}
          <span className="font-mono text-[#64748B]">({specialMatchedIds.size})</span>
        </span>
      </label>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">
          Make &amp; Model
        </label>
        <Select
          aria-label="Make and Model"
          value={makeModelFilter}
          onChange={(e) => setMakeModelFilter(e.target.value)}
          className="h-10 text-xs"
        >
          <option value="All">Make &amp; Model (All)</option>
          {makeModelOptions.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">Dealership</label>
        <Select
          aria-label="Dealership"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value as 'All' | DealershipId)}
          className="h-10 text-xs"
        >
          <option value="All">Dealership (All Branches)</option>
          {activeDealerships.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">
          Vehicle Condition
        </label>
        <Select
          aria-label="Vehicle Condition"
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value as StockCondition)}
          className="h-10 text-xs"
        >
          <option value="All">Vehicle Condition (All)</option>
          <option value="New">New</option>
          <option value="Demo">Demo</option>
          <option value="MasterCars">MasterCars</option>
          <option value="Used">Used</option>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">Body Type</label>
        <Select
          aria-label="Body Type"
          value={bodyTypeFilter}
          onChange={(e) => setBodyTypeFilter(e.target.value as VehicleCategory)}
          className="h-10 text-xs"
        >
          <option value="All">Body Type (All)</option>
          <option value="Hatchbacks & Sedans">Hatchbacks &amp; Sedans</option>
          <option value="SUVs">SUVs</option>
          <option value="Commercial">Commercial &amp; Bakkies</option>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">Transmission</label>
        <Select
          aria-label="Transmission"
          value={transmissionFilter}
          onChange={(e) => setTransmissionFilter(e.target.value)}
          className="h-10 text-xs"
        >
          <option value="All">Transmission (All)</option>
          <option value="Automatic">Automatic / DSG</option>
          <option value="Manual">Manual</option>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">
          Kilometres (Mileage)
        </label>
        <Select
          aria-label="Kilometres Mileage"
          value={mileageFilter}
          onChange={(e) => setMileageFilter(e.target.value as MileageRange)}
          className="h-10 text-xs"
        >
          <option value="all">Kilometres (All Mileage)</option>
          <option value="under-1000">Under 1,000 km (Delivery)</option>
          <option value="under-15000">Under 15,000 km</option>
          <option value="under-50000">Under 50,000 km</option>
          <option value="under-100000">Under 100,000 km</option>
          <option value="under-150000">Under 150,000 km</option>
          <option value="over-150000">150,000+ km</option>
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">Year</label>
        <Select
          aria-label="Model Year"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 text-xs"
        >
          <option value="All">Year (All)</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#475569] mb-1">Fuel Type</label>
        <Select
          aria-label="Fuel Type"
          value={fuelFilter}
          onChange={(e) => setFuelFilter(e.target.value as FuelFilter)}
          className="h-10 text-xs"
        >
          <option value="All">Fuel Type (All)</option>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="Hybrid">Hybrid (incl. Plug-in Hybrid)</option>
          <option value="Electric">Electric (EV)</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">Min Price</label>
          <Select
            aria-label="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            className="h-10 px-2.5 text-xs"
          >
            <option value={0}>Min Price</option>
            {PRICE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {formatZAR(p)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">Max Price</label>
          <Select
            aria-label="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="h-10 px-2.5 text-xs"
          >
            <option value={0}>Max Price</option>
            {PRICE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {formatZAR(p)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">Min Monthly</label>
          <Select
            aria-label="Min Monthly"
            value={minMonthly}
            onChange={(e) => setMinMonthly(Number(e.target.value))}
            className="h-10 px-2.5 text-xs"
          >
            <option value={0}>Min Monthly</option>
            {MONTHLY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatZAR(m)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#475569] mb-1">Max Monthly</label>
          <Select
            aria-label="Max Monthly"
            value={maxMonthly}
            onChange={(e) => setMaxMonthly(Number(e.target.value))}
            className="h-10 px-2.5 text-xs"
          >
            <option value={0}>Max Monthly</option>
            {MONTHLY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatZAR(m)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );

  const selectedQuickBranch = quickViewVehicle
    ? dealershipsById[quickViewVehicle.homeDealershipId] ?? activeDealership
    : activeDealership;

  return (
    <section
      aria-labelledby="vehicle-search-showcase-heading"
      className={variant === 'home' ? 'bg-[#F8FAFC] py-14 sm:py-18 border-b border-[#E2E8F0]' : ''}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Centered Header matching Group Showroom tone */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-wider text-[#00437A] uppercase">
            {groupProfile.groupName} Group Inventory · {activeDealership.shortName}
          </p>
          <h2
            id="vehicle-search-showcase-heading"
            className="mt-2 font-display text-3xl font-bold tracking-tight text-[#091224] sm:text-4xl uppercase"
          >
            {variant === 'home' ? 'Find Your Next Vehicle' : 'Vehicles For Sale'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#475569] sm:text-base">
            Explore New, Demo, MasterCars Certified, and quality Used stock across{' '}
            {activeDealerships.map((b) => b.shortName).join(', ')}—filter by mileage, hybrid or
            electric drivetrain, price, and monthly budget.
          </p>
        </div>

        {/* Top Search, Sort & Pagination Toolbar */}
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 lg:flex-row lg:items-center">
          <div className="w-full lg:w-52 shrink-0">
            <Select
              aria-label="Sort vehicles by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 bg-[#F8FAFC] text-xs font-medium"
            >
              <option value="featured">Sort by: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="mileage-asc">Kilometres: Low to High</option>
              <option value="year-desc">Year: Newest First</option>
            </Select>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-0">
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setAppliedSearch(e.target.value);
              }}
              placeholder="Search Make, Model, Year, Body Type, Fuel Type, Colour..."
              aria-label="Search Make, Model, Year, Body Type, Fuel Type, or Colour"
              className="h-10 rounded-r-none border-r-0 text-xs sm:text-sm"
            />
            <button
              type="submit"
              aria-label="Run vehicle search"
              className="inline-flex h-10 w-11 shrink-0 items-center justify-center rounded-r-lg bg-[#001E50] text-white transition-colors hover:bg-[#00437A] cursor-pointer"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {/* Numeric Pagination */}
          <nav
            aria-label="Vehicle inventory pagination"
            className="flex items-center justify-between gap-2 lg:justify-end shrink-0"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="lg:hidden h-9"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{mobileFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
            </Button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {pageNumbers.map((entry, idx) =>
                entry === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-xs text-[#64748B]">
                    ...
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setCurrentPage(entry)}
                    aria-current={safePage === entry ? 'page' : undefined}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors cursor-pointer ${
                      safePage === entry
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#334155] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile Collapsible Filter Drawer */}
        {mobileFiltersOpen && (
          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-5 lg:hidden">
            {filterSidebarContent}
          </div>
        )}

        {/* Main 2-Column Sidebar + Card Grid Layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Desktop Left Faceted Search Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 rounded-xl border border-[#E2E8F0] bg-white p-5 sticky top-20">
            {filterSidebarContent}
          </aside>

          {/* Right Inventory Results Grid */}
          <div className="lg:col-span-9">
            {loadingCatalog && filteredVehicles.length === 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-96 rounded-xl border border-[#E2E8F0] bg-white animate-pulse"
                  />
                ))}
              </div>
            ) : paginatedVehicles.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
                <p className="font-display text-lg font-semibold text-[#091224]">
                  {activeVehicles.length === 0
                    ? 'No vehicles are currently listed in Group Showroom.'
                    : 'No vehicles match your selected filters.'}
                </p>
                <p className="mt-2 text-sm text-[#64748B]">
                  {activeVehicles.length === 0
                    ? 'Sync AutoTrader stock or add New, Demo, MasterCars, and Used vehicles in the Admin Portal to display live listings here.'
                    : 'Try widening your condition, fuel type, mileage, or budget filters.'}
                </p>
                {activeVehicles.length > 0 && hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-5" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Search Filters</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {paginatedVehicles.map((item: CmsVehicle) => {
                  const homeBranch = dealershipsById[item.homeDealershipId] ?? activeDealership;
                  const relatedSpecial = activeSpecials.find(
                    (sp) =>
                      sp.vehicleName &&
                      (sp.vehicleName.toLowerCase().includes(item.model.toLowerCase()) ||
                        item.title.toLowerCase().includes(sp.vehicleName.toLowerCase()))
                  );

                  return (
                    <motion.article
                      key={item.id}
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
                    >
                      <VehicleImageSlider
                        images={item.images}
                        alt={item.title}
                        badge={
                          <div className="absolute top-3 left-3 z-10 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#001E50] shadow-xs backdrop-blur-xs">
                            {item.category}
                          </div>
                        }
                      />

                      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                        <div>
                          {/* Price & Monthly Instalment Row */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-lg font-bold text-[#001E50] tabular-nums">
                              {formatZAR(item.price)}
                            </span>
                            <div className="text-right leading-tight">
                              <span className="block text-[10px] font-medium text-[#64748B]">
                                Finance from
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#091224] tabular-nums">
                                {formatZAR(item.monthlyFrom)} p/m
                                <Info
                                  className="h-3 w-3 text-[#64748B]"
                                  aria-label="Indicative monthly finance instalment"
                                />
                              </span>
                            </div>
                          </div>

                          {/* Title & Derivative */}
                          <h3 className="mt-2.5 font-display text-base font-bold uppercase tracking-tight text-[#091224] line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="mt-0.5 text-xs font-medium text-[#64748B] truncate">
                            {item.variant || item.model}
                          </p>

                          {/* Clean Unboxed Specs Row (Zero-Pill Rule) */}
                          <p className="mt-3 border-t border-[#E2E8F0] pt-2.5 font-mono text-[11px] text-[#475569] tabular-nums">
                            {item.year} ·{' '}
                            {item.mileage === 0
                              ? '0 km'
                              : `${item.mileage.toLocaleString('en-ZA')} km`}{' '}
                            · {item.fuelType} · {item.transmission}
                          </p>

                          {/* Dealership Branch & Phone */}
                          <div className="mt-3 space-y-1 text-xs text-[#334155]">
                            <p className="flex items-center gap-1.5 truncate font-medium">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#00437A]" />
                              <span className="truncate">{homeBranch.name}</span>
                            </p>
                            <p className="flex items-center gap-1.5 font-mono text-[11px]">
                              <Phone className="h-3 w-3 shrink-0 text-[#00437A]" />
                              <a
                                href={toTelHref(homeBranch.receptionNumber)}
                                className="text-[#091224] underline decoration-[#CBD5E1] underline-offset-2 hover:text-[#00437A]"
                              >
                                {homeBranch.receptionNumber}
                              </a>
                            </p>
                          </div>

                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (onApplyFinance) {
                                  onApplyFinance(item);
                                } else if (onNavigate) {
                                  onNavigate('/finance');
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#001E50] underline underline-offset-3 hover:text-[#00437A] cursor-pointer"
                            >
                              <Calculator className="h-3 w-3" />
                              <span>Apply for Finance</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2.5 pt-2 border-t border-[#F1F5F9]">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              onEnquireDeal({
                                title: item.title,
                                price: item.price,
                                dealSummary: relatedSpecial?.description,
                                homeDealershipId: item.homeDealershipId,
                              })
                            }
                          >
                            <span>Enquire Now</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuickViewVehicle(item)}
                          >
                            <span>View</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}

            {variant === 'home' && onNavigate && activeVehicles.length > 0 && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" size="md" onClick={() => onNavigate('/vehicles')}>
                  <span>Open Full Showroom Directory</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Specification Quick-View Dialog */}
      {quickViewVehicle && (
        <Dialog
          open
          onClose={() => setQuickViewVehicle(null)}
          title={quickViewVehicle.title}
          subtitle={`${quickViewVehicle.category} · ${selectedQuickBranch.name}`}
          maxWidthClass="max-w-2xl"
        >
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <VehicleImageSlider
                images={quickViewVehicle.images}
                alt={quickViewVehicle.title}
                aspectClassName="aspect-16/10"
              />
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#E2E8F0] pb-4">
              <div>
                <span className="block text-xs text-[#64748B]">
                  {quickViewVehicle.category === 'New' ? 'From Retail' : 'Selling Price'}
                </span>
                <span className="font-mono text-2xl font-bold text-[#001E50] tabular-nums">
                  {formatZAR(quickViewVehicle.price)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-[#64748B]">Estimated Finance</span>
                <span className="font-mono text-base font-semibold text-[#091224] tabular-nums">
                  From {formatZAR(quickViewVehicle.monthlyFrom)} p/m
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-[#64748B]">Condition</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">{quickViewVehicle.category}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Year</dt>
                <dd className="mt-0.5 font-semibold text-[#091224] font-mono">
                  {quickViewVehicle.year}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Kilometres</dt>
                <dd className="mt-0.5 font-semibold text-[#091224] font-mono">
                  {quickViewVehicle.mileage.toLocaleString('en-ZA')} km
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Fuel Type</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">{quickViewVehicle.fuelType}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Transmission</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">
                  {quickViewVehicle.transmission}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Body Type</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">
                  {quickViewVehicle.bodyStyle}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Colour</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">{quickViewVehicle.colour}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Power / Economy</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">
                  {quickViewVehicle.powerKw} · {quickViewVehicle.fuelEconomy}
                </dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Holding Dealership</dt>
                <dd className="mt-0.5 font-semibold text-[#091224]">{selectedQuickBranch.name}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#E2E8F0] pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const target = quickViewVehicle;
                  setQuickViewVehicle(null);
                  onBookTestDrive(target.title, target.homeDealershipId);
                }}
              >
                Book Test Drive
              </Button>
              {onApplyFinance && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const target = quickViewVehicle;
                    setQuickViewVehicle(null);
                    onApplyFinance(target);
                  }}
                >
                  Apply for Finance
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const target = quickViewVehicle;
                  setQuickViewVehicle(null);
                  onEnquireDeal({
                    title: target.title,
                    price: target.price,
                    homeDealershipId: target.homeDealershipId,
                  });
                }}
              >
                <span>Enquire Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
