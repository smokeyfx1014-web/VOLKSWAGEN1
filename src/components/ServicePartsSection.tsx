import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Cog, Wrench } from 'lucide-react';
import { SERVICE_PARTS_ASSETS } from '../data/dealershipData';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button } from './ui/shadcn';

interface ServicePartsSectionProps {
  onBookService: () => void;
  onOrderParts: () => void;
}

export function ServicePartsSection({
  onBookService,
  onOrderParts,
}: ServicePartsSectionProps) {
  return (
    <section
      id="service-parts"
      aria-labelledby="service-parts-heading"
      className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker="After-Sales Excellence"
          title="Approved Service & Genuine Parts"
          description="Keep your Volkswagen performing as engineered with factory-calibrated diagnostics, certified Newcastle technicians, and genuine OEM components."
        />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Service Card */}
          <FadeUp>
            <motion.article
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-xl"
            >
              <DealershipImage
                asset={SERVICE_PARTS_ASSETS.service}
                alt="Newcastle Volkswagen Approved Service Centre"
                className="border-b border-[#E2E8F0]"
              />

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2.5 text-[#001E50]">
                    <Wrench className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      Approved Workshop
                    </span>
                  </div>

                  <h3
                    id="service-parts-heading"
                    className="mt-3 font-display text-2xl font-semibold tracking-tight text-[#091224]"
                  >
                    Volkswagen Service Centre
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                    Scheduled maintenance, warranty repairs, wheel alignment, and multi-point diagnostics carried out with factory tooling to protect your service history and resale value.
                  </p>

                  <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>Volkswagen factory-trained master technicians</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>Express service bays & digital service book updates</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>Complimentary local shuttle drop-off in Newcastle CBD</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-7 border-t border-[#E2E8F0] pt-6">
                  <Button size="lg" onClick={onBookService} className="w-full sm:w-auto">
                    <span>Book a Service</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.article>
          </FadeUp>

          {/* Parts Card */}
          <FadeUp delay={0.08}>
            <motion.article
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-xl"
            >
              <DealershipImage
                asset={SERVICE_PARTS_ASSETS.parts}
                alt="Genuine Volkswagen Parts & Accessories"
                className="border-b border-[#E2E8F0]"
              />

              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2.5 text-[#001E50]">
                    <Cog className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      Parts & Accessories
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-[#091224]">
                    Genuine Volkswagen Parts
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                    Direct counter supply for private owners, panel beaters, and commercial fleets across Northern KwaZulu-Natal—engineered to original factory tolerances.
                  </p>

                  <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>2-year unlimited-kilometre warranty on Genuine Parts</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>VIN-matched ordering for passenger & commercial models</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 shrink-0 text-[#00437A]" />
                      <span>Original VW Lifestyle accessories, roof racks & towbars</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-7 border-t border-[#E2E8F0] pt-6">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={onOrderParts}
                    className="w-full sm:w-auto"
                  >
                    <span>Request Genuine Parts</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.article>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
