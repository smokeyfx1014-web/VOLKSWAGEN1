import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Calendar, Clock, MapPin } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { CmsNewsArticle, DealershipId, MotoringArticle } from '../types/dealership';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button } from './ui/shadcn';

interface NewsAndEventsPageProps {
  onSelectArticle: (article: MotoringArticle) => void;
  onRsvpEvent: (eventTitle: string, homeDealershipId?: DealershipId | null) => void;
}

function toModalArticle(cms: CmsNewsArticle): MotoringArticle {
  return {
    id: cms.id,
    category: cms.category,
    publishedDate: cms.publishedDate,
    readTime: cms.readTime,
    title: cms.title,
    excerpt: cms.excerpt,
    body: cms.bodyText
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean),
    featured: cms.featured,
    asset: {
      slotId: `CMS-${cms.id}`,
      targetPath: cms.imageSrc,
      src: cms.imageSrc,
      aspectRatio: '16:9',
      dimensions: '1200 × 900 px',
      subject: cms.title,
      tone: 'light',
    },
  };
}

export function NewsAndEventsPage({
  onSelectArticle,
  onRsvpEvent,
}: NewsAndEventsPageProps) {
  const { activeDealership, dealershipsById } = useDealership();
  const { activeNews, activeEvents } = useDealershipData();

  const featuredNews = activeNews.find((a) => a.featured) ?? activeNews[0];
  const secondaryNews = activeNews.filter((a) => a.id !== featuredNews?.id);

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Section 1: Upcoming Scoped Dealership Events */}
        <section aria-labelledby="events-heading">
          <SectionHeader
            kicker="Dealership Calendar"
            title={`Upcoming ${activeDealership.name} & Group Events`}
            description={`Test-drive Saturdays, seasonal multi-point safety clinics, and new model previews scoped to ${activeDealership.shortName} and the Asaf Auto Sales Group. Past events automatically archive after their end date.`}
          />

          {activeEvents.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-10 text-center">
              <p className="text-base font-medium text-[#091224]">
                No upcoming events are scheduled right now for {activeDealership.shortName}.
              </p>
              <p className="mt-1 text-sm text-[#475569]">
                New launch previews and showroom clinics published by our dealership team appear here automatically.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeEvents.map((ev, idx) => {
                const scopeLabel =
                  ev.scope === 'MASTER'
                    ? 'All Group Branches'
                    : `${dealershipsById[ev.dealershipId ?? activeDealership.id]?.shortName} Event`;

                return (
                  <FadeUp key={ev.id} delay={idx * 0.06}>
                    <motion.article
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] transition-shadow hover:shadow-lg"
                    >
                      <div className="relative aspect-16/10 w-full overflow-hidden border-b border-[#E2E8F0] bg-[#E2E8F0]">
                        <img
                          src={ev.imageUrl}
                          alt={ev.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                        <div className="absolute top-3 left-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#001E50] shadow-xs">
                          {scopeLabel}
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <p className="text-xs font-semibold text-[#00437A]">
                            {ev.vehicleName || 'Dealership Event'}
                          </p>
                          <h3
                            id={idx === 0 ? 'events-heading' : undefined}
                            className="mt-2 font-display text-xl font-semibold text-[#091224] text-balance"
                          >
                            {ev.title}
                          </h3>

                          <dl className="mt-4 space-y-2 border-y border-[#E2E8F0] py-3 text-xs text-[#334155]">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-[#001E50] shrink-0" />
                              <dd className="font-mono font-medium">{ev.validUntil}</dd>
                            </div>
                            {ev.eventTime && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-[#001E50] shrink-0" />
                                <dd>{ev.eventTime}</dd>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-[#001E50] shrink-0" />
                              <dd>{ev.location || activeDealership.physicalAddress}</dd>
                            </div>
                          </dl>

                          <p className="mt-4 text-sm leading-relaxed text-[#475569]">
                            {ev.description}
                          </p>
                        </div>

                        <div className="mt-6">
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              onRsvpEvent(
                                `${ev.title} (${ev.validUntil})`,
                                ev.dealershipId ?? activeDealership.id
                              )
                            }
                          >
                            <span>RSVP / Reserve Spot</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  </FadeUp>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Motoring News */}
        <section
          aria-labelledby="motoring-news-heading"
          className="border-t border-[#E2E8F0] pt-16"
        >
          <SectionHeader
            kicker="Motoring News"
            title={`Stories from Volkswagen Group Africa & ${activeDealership.province}`}
            description={`Stay informed on local Kariega plant milestones, new safety innovations, and seasonal vehicle maintenance insights from our ${activeDealership.shortName} team.`}
          />

          {featuredNews && (
            <FadeUp className="mt-10">
              <motion.article
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="group grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] transition-shadow duration-200 hover:shadow-lg lg:grid-cols-12"
              >
                <div className="lg:col-span-7 overflow-hidden bg-[#E2E8F0]">
                  <img
                    src={featuredNews.imageSrc}
                    alt={featuredNews.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-video h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>

                <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                      <span className="font-semibold text-[#00437A]">Featured</span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredNews.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredNews.publishedDate}</span>
                    </div>

                    <h3
                      id="motoring-news-heading"
                      className="mt-4 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#091224] text-balance"
                    >
                      {featuredNews.title}
                    </h3>

                    <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#475569]">
                      {featuredNews.excerpt}
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-5">
                    <span className="text-xs font-mono text-[#64748B]">
                      {featuredNews.readTime}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onSelectArticle(toModalArticle(featuredNews))}
                    >
                      <span>Read Full Article</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.article>
            </FadeUp>
          )}

          {secondaryNews.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {secondaryNews.map((article, idx) => (
                <FadeUp key={article.id} delay={idx * 0.06}>
                  <motion.article
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
                  >
                    <div className="aspect-4/3 w-full overflow-hidden border-b border-[#E2E8F0] bg-[#F1F5F9]">
                      <img
                        src={article.imageSrc}
                        alt={article.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                          <span className="font-semibold text-[#00437A]">{article.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{article.publishedDate}</span>
                          <span aria-hidden="true">·</span>
                          <span>{article.readTime}</span>
                        </div>

                        <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-[#091224] text-balance">
                          {article.title}
                        </h3>

                        <p className="mt-2.5 text-sm leading-relaxed text-[#475569]">
                          {article.excerpt}
                        </p>
                      </div>

                      <div className="mt-6 border-t border-[#E2E8F0] pt-4">
                        <button
                          type="button"
                          onClick={() => onSelectArticle(toModalArticle(article))}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#001E50] transition-colors hover:text-[#00437A] cursor-pointer"
                        >
                          <span>Read Article</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.article>
                </FadeUp>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
