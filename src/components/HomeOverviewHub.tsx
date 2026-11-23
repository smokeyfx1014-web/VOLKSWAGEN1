import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Calculator,
  CalendarDays,
  MapPin,
  Newspaper,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { formatZAR } from '../lib/utils';
import { AppRoute } from '../types/dealership';
import { FadeUp, SectionHeader } from './MotionPrimitives';

interface HomeOverviewHubProps {
  onNavigate: (route: AppRoute) => void;
}

export function HomeOverviewHub({ onNavigate }: HomeOverviewHubProps) {
  const { activeDealership } = useDealership();
  const { activeSpecials, activeEvents, activeCompetitions, activeNews } = useDealershipData();

  const nextEvent = activeEvents[0];
  const leadNews = activeNews.find((a) => a.featured) ?? activeNews[0];
  const topSpecial = activeSpecials[0];
  const topCompetition = activeCompetitions[0];

  const departments: {
    route: AppRoute;
    icon: React.ComponentType<{ className?: string }>;
    kicker: string;
    title: string;
    summary: string;
    highlight: string;
    cta: string;
  }[] = [
    {
      route: '/specials',
      icon: Sparkles,
      kicker: 'Dated Offers & Competitions',
      title: `${activeDealership.shortName} Specials & Offers`,
      summary: topSpecial
        ? `${topSpecial.title} — ${topSpecial.description}`
        : topCompetition
        ? `${topCompetition.title} — ${topCompetition.description}`
        : `Explore current ${activeDealership.name} and group-wide finance offers.`,
      highlight:
        activeSpecials.length + activeCompetitions.length > 0
          ? `${activeSpecials.length} specials · ${activeCompetitions.length} competitions`
          : 'Updated live from group CMS',
      cta: 'Explore Specials',
    },
    {
      route: '/finance',
      icon: Calculator,
      kicker: `Authorised FSP No. ${activeDealership.fspNumber}`,
      title: 'Volkswagen Financial Services',
      summary:
        'Calculate non-binding ZAR monthly instalments, adjust deposit & balloon terms, and apply through our dealership F&I team.',
      highlight: topSpecial && topSpecial.monthlyFrom > 0
        ? `Instalments from ${formatZAR(topSpecial.monthlyFrom)} p/m · VWFS ${activeDealership.vwFinancialServices}`
        : `VWFS: ${activeDealership.vwFinancialServices}`,
      cta: 'Open Finance Calculator',
    },
    {
      route: '/aftersales',
      icon: Wrench,
      kicker: 'Service & Parts Hub',
      title: 'Aftersales Care & Genuine Parts',
      summary: `Book scheduled workshop servicing or submit VIN-matched Genuine OEM Volkswagen Parts requests at ${activeDealership.name}.`,
      highlight: `${activeDealership.serviceHours} · 2-Year Parts Warranty`,
      cta: 'Open Aftersales Hub',
    },
    {
      route: '/news-events',
      icon: Newspaper,
      kicker: 'Editorial & Calendar',
      title: 'Motoring News & Dealership Events',
      summary: nextEvent
        ? `Upcoming Event (${nextEvent.validUntil}): ${nextEvent.title}`
        : leadNews?.title ?? 'Read Volkswagen Group Africa updates and local branch event announcements.',
      highlight: `${activeNews.length} articles · ${activeEvents.length} upcoming events`,
      cta: 'Read News & Events',
    },
    {
      route: '/test-drive',
      icon: CalendarDays,
      kicker: 'Showroom Appointments',
      title: `Book a Test Drive in ${activeDealership.city}`,
      summary: `Reserve your demonstration drive at ${activeDealership.physicalAddress} with callback confirmation from our floor team.`,
      highlight: 'Mon–Fri 09:00–15:00 · Sat 09:00–11:00',
      cta: 'Schedule Test Drive',
    },
    {
      route: '/contact',
      icon: MapPin,
      kicker: 'Visit or Call Us',
      title: activeDealership.physicalAddress,
      summary:
        'View Sales vs Service & Parts operating hours, embedded branch map directions, or message our local reception.',
      highlight: `Reception: ${activeDealership.receptionNumber} · VW Alert: ${activeDealership.roadsideAssist}`,
      cta: 'Contact & Directions',
    },
  ];

  return (
    <section aria-labelledby="overview-hub-heading" className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker={`Explore ${activeDealership.name}`}
          title="Everything in one streamlined hub"
          description={`Jump directly to the ${activeDealership.shortName} department you need—from live specials and Master Group stock to aftersales, news, and upcoming events.`}
        />

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept, index) => {
            const Icon = dept.icon;
            return (
              <FadeUp key={dept.route} delay={(index % 3) * 0.05}>
                <motion.button
                  type="button"
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => onNavigate(dept.route)}
                  className="group flex h-full w-full flex-col justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-left transition-all duration-200 hover:border-[#001E50]/40 hover:bg-white hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-[#00437A]">{dept.kicker}</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#001E50] transition-colors group-hover:bg-[#001E50] group-hover:text-white">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>

                    <h3
                      id={index === 0 ? 'overview-hub-heading' : undefined}
                      className="mt-4 font-display text-xl font-semibold tracking-tight text-[#091224]"
                    >
                      {dept.title}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-[#475569] line-clamp-3">
                      {dept.summary}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                    <p className="font-mono text-[11px] text-[#64748B] truncate">
                      {dept.highlight}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#001E50] group-hover:text-[#00437A]">
                      <span>{dept.cta}</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1" />
                    </div>
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
