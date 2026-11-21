import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Calculator,
  Car,
  CheckCircle2,
  Gauge,
  MapPin,
} from 'lucide-react';
import { STARTING_POINT_ASSETS } from '../data/dealershipData';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';

interface StartingPointSectionProps {
  onExploreModels: () => void;
  onShowInStock: () => void;
  onBookTestDrive: () => void;
  onOpenFinance: () => void;
  onScrollToContact: () => void;
}

export function StartingPointSection({
  onExploreModels,
  onShowInStock,
  onBookTestDrive,
  onOpenFinance,
  onScrollToContact,
}: StartingPointSectionProps) {
  const cards = [
    {
      id: 'explore-models',
      index: '01',
      title: 'Explore Models',
      description: 'Browse the complete South African Volkswagen passenger & commercial range.',
      icon: Car,
      asset: STARTING_POINT_ASSETS.exploreModels,
      actionLabel: 'View lineup',
      onClick: onExploreModels,
    },
    {
      id: 'in-stock-now',
      index: '02',
      title: 'In Stock Now',
      description: 'Vehicles on our Newcastle floor ready for immediate delivery.',
      icon: CheckCircle2,
      asset: STARTING_POINT_ASSETS.inStock,
      actionLabel: 'Filter available',
      onClick: onShowInStock,
    },
    {
      id: 'book-test-drive',
      index: '03',
      title: 'Book Test Drive',
      description: 'Schedule a tailored test drive from 77 Allen Street at your convenience.',
      icon: Gauge,
      asset: STARTING_POINT_ASSETS.testDrive,
      actionLabel: 'Schedule drive',
      onClick: onBookTestDrive,
    },
    {
      id: 'finance',
      index: '04',
      title: 'Finance',
      description: 'Estimate monthly Rand instalments and apply via VW Financial Services.',
      icon: Calculator,
      asset: STARTING_POINT_ASSETS.finance,
      actionLabel: 'Calculate plan',
      onClick: onOpenFinance,
    },
    {
      id: 'contact-us',
      index: '05',
      title: 'Contact Us',
      description: 'Connect directly with Sales, Service, Parts, or MasterCars specialists.',
      icon: MapPin,
      asset: STARTING_POINT_ASSETS.contactUs,
      actionLabel: 'Get in touch',
      onClick: onScrollToContact,
    },
  ];

  return (
    <section
      id="starting-point"
      aria-labelledby="starting-point-heading"
      className="border-b border-[#E2E8F0] bg-white py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader
            kicker="Your Starting Point"
            title="Every dealership journey in one clear place"
            description="Select where you would like to begin—from inspecting showroom inventory to structuring finance or booking your next scheduled service."
          />
          <FadeUp delay={0.1}>
            <p className="text-xs font-mono text-[#475569] tabular-nums">
              77 Allen St · Newcastle CBD · +27 34 328 3600
            </p>
          </FadeUp>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <FadeUp key={card.id} delay={idx * 0.05}>
                <motion.button
                  type="button"
                  onClick={card.onClick}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-left transition-all duration-200 hover:border-[#001E50]/40 hover:bg-white hover:shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A]"
                >
                  <div className="w-full">
                    <DealershipImage
                      asset={card.asset}
                      alt={card.title}
                      className="border-b border-[#E2E8F0]"
                    />
                    <div className="p-5 pb-0">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#001E50] transition-colors group-hover:bg-[#001E50] group-hover:text-white group-hover:border-[#001E50]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-xs text-[#64748B]">{card.index}</span>
                      </div>

                      <h3
                        id={idx === 0 ? 'starting-point-heading' : undefined}
                        className="mt-4 font-display text-lg font-semibold tracking-tight text-[#091224] group-hover:text-[#001E50]"
                      >
                        {card.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 mx-5 mb-5 flex items-center justify-between border-t border-[#E2E8F0] pt-3.5 text-xs font-semibold text-[#001E50]">
                    <span className="whitespace-nowrap">{card.actionLabel}</span>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </motion.button>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
