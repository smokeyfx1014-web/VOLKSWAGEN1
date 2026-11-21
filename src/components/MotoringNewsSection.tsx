import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { MOTORING_ARTICLES } from '../data/dealershipData';
import { MotoringArticle } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button } from './ui/shadcn';

interface MotoringNewsSectionProps {
  onSelectArticle: (article: MotoringArticle) => void;
}

export function MotoringNewsSection({ onSelectArticle }: MotoringNewsSectionProps) {
  const featuredArticle =
    MOTORING_ARTICLES.find((a) => a.featured) ?? MOTORING_ARTICLES[0];
  const secondaryArticles = MOTORING_ARTICLES.filter(
    (a) => a.id !== featuredArticle.id
  );

  return (
    <section
      id="motoring-news"
      aria-labelledby="motoring-news-heading"
      className="border-b border-[#E2E8F0] bg-white py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker="Motoring News"
          title="Stories from Volkswagen Group Africa & KZN"
          description="Stay informed on local Kariega plant milestones, new safety innovations, and seasonal vehicle maintenance insights from our Newcastle team."
        />

        {/* Featured Lead Article */}
        <FadeUp className="mt-10">
          <motion.article
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] transition-shadow duration-200 hover:shadow-lg lg:grid-cols-12"
          >
            <div className="lg:col-span-7">
              <DealershipImage
                asset={featuredArticle.asset}
                alt={featuredArticle.title}
                aspectClassName="aspect-video lg:h-full"
                className="h-full"
              />
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                  <span className="font-semibold text-[#00437A]">Featured</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredArticle.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{featuredArticle.publishedDate}</span>
                </div>

                <h3
                  id="motoring-news-heading"
                  className="mt-4 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#091224] text-balance"
                >
                  {featuredArticle.title}
                </h3>

                <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#475569]">
                  {featuredArticle.excerpt}
                </p>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[#E2E8F0] pt-5">
                <span className="text-xs font-mono text-[#64748B]">
                  {featuredArticle.readTime}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectArticle(featuredArticle)}
                >
                  <span>Read Full Article</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.article>
        </FadeUp>

        {/* Secondary Editorial Articles */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {secondaryArticles.map((article, idx) => (
            <FadeUp key={article.id} delay={idx * 0.08}>
              <motion.article
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white transition-shadow duration-200 hover:shadow-lg"
              >
                <DealershipImage
                  asset={article.asset}
                  alt={article.title}
                  className="border-b border-[#E2E8F0]"
                />

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
                      onClick={() => onSelectArticle(article)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#001E50] transition-colors hover:text-[#00437A] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A] rounded"
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
      </div>
    </section>
  );
}
