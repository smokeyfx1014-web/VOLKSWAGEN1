import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ShieldCheck } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { FINANCE_SECTION_ASSET } from '../data/dealership';
import { calculateMonthlyFinance, formatZAR } from '../lib/utils';
import { AppRoute, DealershipId } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import {
  FinanceApplicationWizard,
  FinanceSimulatorSnapshot,
} from './FinanceApplicationWizard';
import { FadeUp } from './MotionPrimitives';
import { Button, Input, Label, Select } from './ui/shadcn';

interface FinanceSectionProps {
  onNavigate?: (route: AppRoute) => void;
  onApplyFinance?: (preset: {
    vehicleName: string;
    vehiclePrice: number;
    homeDealershipId?: DealershipId | null;
    depositPercent: number;
    balloonPercent: number;
    termMonths: number;
    monthlyEstimate: number;
  }) => void;
}

export function FinanceSection({ onNavigate, onApplyFinance }: FinanceSectionProps) {
  const { activeDealership, dealershipsById } = useDealership();
  const { activeVehicles } = useDealershipData();

  const wizardRef = useRef<HTMLDivElement | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState(
    activeVehicles[0]?.id ?? 'polo-vivo'
  );
  const selectedVehicle =
    activeVehicles.find((v) => v.id === selectedVehicleId) ?? activeVehicles[0];

  const [vehiclePrice, setVehiclePrice] = useState(selectedVehicle?.price ?? 271900);
  const [depositPercent, setDepositPercent] = useState(10);
  const [balloonPercent, setBalloonPercent] = useState(30);
  const [termMonths, setTermMonths] = useState(72);
  const [interestRate, setInterestRate] = useState(10.25);

  useEffect(() => {
    if (selectedVehicle && !activeVehicles.some((v) => v.id === selectedVehicleId)) {
      setSelectedVehicleId(selectedVehicle.id);
      setVehiclePrice(selectedVehicle.price);
    }
  }, [activeVehicles, selectedVehicle, selectedVehicleId]);

  const handleModelChange = (id: string) => {
    setSelectedVehicleId(id);
    const match = activeVehicles.find((v) => v.id === id);
    if (match) {
      setVehiclePrice(match.price);
    }
  };

  const result = useMemo(
    () =>
      calculateMonthlyFinance({
        vehiclePrice,
        depositPercent,
        balloonPercent,
        interestRate,
        termMonths,
      }),
    [vehiclePrice, depositPercent, balloonPercent, interestRate, termMonths]
  );

  const simulatorSnapshot: FinanceSimulatorSnapshot = useMemo(
    () => ({
      selectedVehicleId: selectedVehicle?.id ?? 'custom',
      vehicleName: selectedVehicle?.title ?? 'Volkswagen Vehicle',
      vehiclePrice,
      depositAmount: result.depositAmount,
      depositPercent,
      balloonPercent,
      interestRate,
      termMonths,
      monthlyInstalment: result.monthlyInstalment,
      homeDealershipId: selectedVehicle?.homeDealershipId ?? activeDealership.id,
    }),
    [
      selectedVehicle,
      vehiclePrice,
      result.depositAmount,
      result.monthlyInstalment,
      depositPercent,
      balloonPercent,
      interestRate,
      termMonths,
      activeDealership.id,
    ]
  );

  const handleSyncFromWizard = (patch: {
    selectedVehicleId?: string;
    vehiclePrice?: number;
    depositAmount?: number;
  }) => {
    if (patch.selectedVehicleId) {
      setSelectedVehicleId(patch.selectedVehicleId);
    }
    if (typeof patch.vehiclePrice === 'number' && patch.vehiclePrice > 0) {
      setVehiclePrice(patch.vehiclePrice);
    }
    if (typeof patch.depositAmount === 'number' && vehiclePrice > 0) {
      const pct = Math.min(40, Math.max(0, Math.round((patch.depositAmount / vehiclePrice) * 100)));
      setDepositPercent(pct);
    }
  };

  return (
    <section
      id="finance"
      aria-labelledby="finance-heading"
      className="border-b border-[#E2E8F0] bg-white py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Visual Asset & Value Proposition */}
          <FadeUp className="flex flex-col justify-between lg:col-span-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#00437A] uppercase">
                Volkswagen Financial Services · {activeDealership.vwFinancialServices}
              </p>
              <h2
                id="finance-heading"
                className="mt-2.5 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#091224] text-balance"
              >
                Tailored finance built around your budget
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                Our dedicated Finance &amp; Insurance specialists at {activeDealership.name} structure transparent instalment plans, Guaranteed Future Value (GFV) options, and seamless trade-in settlements across our group inventory.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-[#334155]">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                  <span>Fast pre-qualification across major South African automotive banks</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                  <span>Flexible 12 to 72-month terms with optional residual balloon</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                  <span>
                    VolkswagenSure ({activeDealership.volkswagensure}) &amp; Service Plan integration
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-[#E2E8F0]">
              <DealershipImage
                asset={FINANCE_SECTION_ASSET}
                alt={`${activeDealership.name} Finance & Handover Lounge`}
              />
            </div>
          </FadeUp>

          {/* Right Column: Synchronized Interactive Rand Finance Calculator */}
          <FadeUp delay={0.1} className="lg:col-span-7">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#091224]">
                      Interactive Loan Simulator
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      Synced live with your 4-step online finance application below
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-[#64748B]">Estimated Monthly</span>
                    <span className="font-mono text-2xl sm:text-3xl font-semibold text-[#001E50] tabular-nums">
                      {formatZAR(result.monthlyInstalment)}
                      <span className="text-sm font-normal text-[#475569]"> /mo</span>
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="finance-model-select">Select Group Vehicle</Label>
                    <Select
                      id="finance-model-select"
                      value={selectedVehicle?.id ?? ''}
                      onChange={(e) => handleModelChange(e.target.value)}
                    >
                      {activeVehicles.map((model) => {
                        const branch = dealershipsById[model.homeDealershipId];
                        return (
                          <option key={model.id} value={model.id}>
                            {model.title} ({formatZAR(model.price)} · {branch?.shortName})
                          </option>
                        );
                      })}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="finance-price-input">Vehicle Price (ZAR)</Label>
                    <Input
                      id="finance-price-input"
                      type="number"
                      min={50000}
                      max={3000000}
                      step={5000}
                      value={vehiclePrice}
                      onChange={(e) => setVehiclePrice(Math.max(0, Number(e.target.value)))}
                      className="font-mono bg-white"
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <label htmlFor="months-range" className="text-[#334155]">
                        Months ({termMonths / 12} {termMonths === 12 ? 'Year' : 'Years'})
                      </label>
                      <span className="font-mono font-semibold text-[#091224] tabular-nums">
                        {termMonths} Months
                      </span>
                    </div>
                    <input
                      id="months-range"
                      type="range"
                      min={12}
                      max={72}
                      step={12}
                      value={termMonths}
                      onChange={(e) => setTermMonths(Number(e.target.value))}
                      className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <label htmlFor="deposit-range" className="text-[#334155]">
                          Deposit Amount
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {depositPercent.toFixed(2)} % ({formatZAR(result.depositAmount)})
                        </span>
                      </div>
                      <input
                        id="deposit-range"
                        type="range"
                        min={0}
                        max={40}
                        step={5}
                        value={depositPercent}
                        onChange={(e) => setDepositPercent(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <label htmlFor="rate-range" className="text-[#334155]">
                          Interest
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {interestRate.toFixed(2)} %
                        </span>
                      </div>
                      <input
                        id="rate-range"
                        type="range"
                        min={9.5}
                        max={16.5}
                        step={0.25}
                        value={interestRate}
                        onChange={(e) => setInterestRate(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <label htmlFor="balloon-range" className="text-[#334155]">
                          Balloon
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {balloonPercent.toFixed(2)} % ({formatZAR(result.balloonAmount)})
                        </span>
                      </div>
                      <input
                        id="balloon-range"
                        type="range"
                        min={0}
                        max={40}
                        step={5}
                        value={balloonPercent}
                        onChange={(e) => setBalloonPercent(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#E2E8F0] pt-5 space-y-5">
                <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-[#64748B]">Principal Financed</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                      {formatZAR(result.principalFinanced)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">Balloon Payment</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                      {formatZAR(result.balloonAmount)}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-[#64748B]">Term &amp; Rate</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                      {termMonths} mo · {interestRate.toFixed(2)}%
                    </dd>
                  </div>
                </dl>

                {/* Complete Legal Terms & Conditions from Legacy Site */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-[11px] leading-relaxed text-[#475569] space-y-2">
                  <p className="text-xs font-semibold text-[#001E50]">Terms &amp; Conditions</p>
                  <p>
                    <strong className="text-[#091224]">Instalments</strong> are indicative only and are based on certain assumptions and approximations that may not apply to all customers.
                  </p>
                  <p>
                    The finance calculator is a form of loan simulator and is not an offer by the seller, nor does it constitute financial advice in any form or manner. The finance calculator is provided to you for information and convenience purposes only. The finance calculator will not pre-qualify you for any loan programs whatsoever.
                  </p>
                  <p>
                    Actual instalments on loans obtained from financial institutions will vary depending on: the current prime interest rate, the financial institution&apos;s variables, the type, condition and age of the vehicle, your credit rating with the financial institution concerned, the respective initiation fees and the time period between the effective date of the loan and the first instalment payable. Please note that you should seek appropriate financial advice before concluding any loan agreements.
                  </p>
                  <p className="pt-2 border-t border-[#F1F5F9] font-medium text-[#00437A]">
                    Protected by Docrat group Information Technology · {activeDealership.legalEntity} t/a {activeDealership.name} (Authorised FSP No. {activeDealership.fspNumber})
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {onApplyFinance && (
                    <button
                      type="button"
                      onClick={() =>
                        onApplyFinance({
                          vehicleName: selectedVehicle?.title ?? 'Volkswagen Vehicle',
                          vehiclePrice,
                          homeDealershipId:
                            selectedVehicle?.homeDealershipId ?? activeDealership.id,
                          depositPercent,
                          balloonPercent,
                          termMonths,
                          monthlyEstimate: Math.round(result.monthlyInstalment),
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00437A] hover:text-[#001E50] hover:underline cursor-pointer"
                    >
                      <span>Prefer a quick callback instead? Request F&amp;I Callback</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <Button
                    size="lg"
                    onClick={() =>
                      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    <span>Start Full 4-Step Application</span>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Full 4-Step FSP / NCA Credit Application */}
        <FinanceApplicationWizard
          simulator={simulatorSnapshot}
          onSyncFromWizard={handleSyncFromWizard}
          onNavigate={onNavigate}
          wizardRef={wizardRef}
        />
      </div>
    </section>
  );
}
