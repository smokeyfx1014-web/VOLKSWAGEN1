import React, { useMemo, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  DEALERSHIP_INFO,
  FINANCE_SECTION_ASSET,
  VEHICLE_MODELS,
} from '../data/dealership';
import { calculateMonthlyFinance, formatZAR } from '../lib/utils';
import { DealershipImage } from './DealershipImage';
import { FadeUp } from './MotionPrimitives';
import { Button, Label, Select } from './ui/shadcn';

interface FinanceSectionProps {
  onApplyFinance: (preset: {
    vehicleName: string;
    vehiclePrice: number;
    depositPercent: number;
    balloonPercent: number;
    termMonths: number;
    monthlyEstimate: number;
  }) => void;
}

export function FinanceSection({ onApplyFinance }: FinanceSectionProps) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(VEHICLE_MODELS[0].id);
  const selectedVehicle =
    VEHICLE_MODELS.find((v) => v.id === selectedVehicleId) ?? VEHICLE_MODELS[0];

  const [vehiclePrice, setVehiclePrice] = useState(selectedVehicle.priceFrom);
  const [depositPercent, setDepositPercent] = useState(10);
  const [balloonPercent, setBalloonPercent] = useState(30);
  const [termMonths, setTermMonths] = useState(60);
  const [interestRate, setInterestRate] = useState(11.75);

  const handleModelChange = (id: string) => {
    setSelectedVehicleId(id);
    const match = VEHICLE_MODELS.find((v) => v.id === id);
    if (match) {
      setVehiclePrice(match.priceFrom);
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
                Volkswagen Financial Services
              </p>
              <h2
                id="finance-heading"
                className="mt-2.5 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#091224] text-balance"
              >
                Tailored finance built around your budget
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                Our dedicated Finance & Insurance specialists at Newcastle Volkswagen structure transparent instalment plans, Guaranteed Future Value (GFV) options, and seamless trade-in settlements.
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
                  <span>Comprehensive VW Service Plans, Warranties & Tyre Guard integration</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-[#E2E8F0]">
              <DealershipImage
                asset={FINANCE_SECTION_ASSET}
                alt="Newcastle Volkswagen Finance & Handover Lounge"
              />
            </div>
          </FadeUp>

          {/* Right Column: Interactive Rand Finance Calculator */}
          <FadeUp delay={0.1} className="lg:col-span-7">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#091224]">
                      Interactive Instalment Estimator
                    </h3>
                    <p className="mt-1 text-xs text-[#475569]">
                      Indicative South African Rand (ZAR) calculation · Subject to bank approval
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
                    <Label htmlFor="finance-model-select">Select Volkswagen Model</Label>
                    <Select
                      id="finance-model-select"
                      value={selectedVehicleId}
                      onChange={(e) => handleModelChange(e.target.value)}
                    >
                      {VEHICLE_MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({formatZAR(model.priceFrom)})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="finance-term-select">Repayment Term</Label>
                    <Select
                      id="finance-term-select"
                      value={termMonths}
                      onChange={(e) => setTermMonths(Number(e.target.value))}
                    >
                      {[36, 48, 60, 72].map((m) => (
                        <option key={m} value={m}>
                          {m} Months ({m / 12} Years)
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <label htmlFor="price-range" className="text-[#334155]">
                        Vehicle Price
                      </label>
                      <span className="font-mono text-[#091224] tabular-nums">
                        {formatZAR(vehiclePrice)}
                      </span>
                    </div>
                    <input
                      id="price-range"
                      type="range"
                      min={250000}
                      max={1500000}
                      step={5000}
                      value={vehiclePrice}
                      onChange={(e) => setVehiclePrice(Number(e.target.value))}
                      className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <label htmlFor="deposit-range" className="text-[#334155]">
                          Deposit ({depositPercent}%)
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {formatZAR(result.depositAmount)}
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
                        <label htmlFor="balloon-range" className="text-[#334155]">
                          Balloon ({balloonPercent}%)
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {formatZAR(result.balloonAmount)}
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

                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <label htmlFor="rate-range" className="text-[#334155]">
                          Interest Rate
                        </label>
                        <span className="font-mono text-[#091224] tabular-nums">
                          {interestRate.toFixed(2)}%
                        </span>
                      </div>
                      <input
                        id="rate-range"
                        type="range"
                        min={9.5}
                        max={15.5}
                        step={0.25}
                        value={interestRate}
                        onChange={(e) => setInterestRate(Number(e.target.value))}
                        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#001E50]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-[#E2E8F0] pt-6">
                <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3 mb-6">
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
                    <dt className="text-[#64748B]">Term & Rate</dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                      {termMonths} mo · {interestRate.toFixed(2)}%
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-[#64748B] max-w-md leading-relaxed">
                    Non-binding loan simulator; excludes on-the-road & documentation fees. {DEALERSHIP_INFO.legalEntity} t/a {DEALERSHIP_INFO.name} is an Authorised Financial Services Provider (FSP No. {DEALERSHIP_INFO.fspNumber}).
                  </p>
                  <Button
                    size="lg"
                    onClick={() =>
                      onApplyFinance({
                        vehicleName: selectedVehicle.name,
                        vehiclePrice,
                        depositPercent,
                        balloonPercent,
                        termMonths,
                        monthlyEstimate: Math.round(result.monthlyInstalment),
                      })
                    }
                  >
                    <span>Apply for Finance</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
