import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { getHeroSlidesForBranch } from '../data/dealership';
import { DealershipImage } from './DealershipImage';
import { Button } from './ui/shadcn';

interface HeroSectionProps {
  onExploreModels: () => void;
  onBookTestDrive: (modelName?: string) => void;
}

export function HeroSection({ onExploreModels, onBookTestDrive }: HeroSectionProps) {
  const { activeDealership } = useDealership();
  const slides = useMemo(() => getHeroSlidesForBranch(activeDealership), [activeDealership]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 6800);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const currentSlide = slides[activeIndex] ?? slides[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  const handleSecondaryAction = () => {
    if (currentSlide.secondaryCtaTarget === 'test-drive') {
      onBookTestDrive();
      return;
    }
    const target = document.querySelector(currentSlide.secondaryCtaTarget);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    } else {
      onExploreModels();
    }
  };

  return (
    <section
      id="hero"
      aria-label={`${activeDealership.name} Featured Showcase`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative min-h-[620px] h-[88vh] max-h-[860px] w-full overflow-hidden bg-[#001E50]"
    >
      {/* Full-Width Animated Slide Backdrop */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 h-full w-full"
        >
          <DealershipImage
            asset={currentSlide.asset}
            alt={currentSlide.headline}
            priority
            zoomOnHover={false}
            aspectClassName="h-full w-full"
            className="h-full w-full"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#061229]/90 via-[#061229]/45 to-[#061229]/30"
          />
        </motion.div>
      </AnimatePresence>

      {/* Glassmorphism Content Card Overlay */}
      <div className="relative z-20 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl rounded-2xl border border-white/20 bg-white/12 p-6 sm:p-8 backdrop-blur-xl shadow-2xl"
            >
              <p className="text-xs font-medium tracking-wide text-white/80">
                {currentSlide.kicker}
              </p>

              <h1 className="mt-3 font-display text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.08] text-balance">
                {currentSlide.headline}
              </h1>

              <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-white/85">
                {currentSlide.subheadline}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-white text-[#001E50] hover:bg-[#F1F5F9]"
                  onClick={onExploreModels}
                >
                  <span>{currentSlide.primaryCtaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="glass" size="lg" onClick={handleSecondaryAction}>
                  {currentSlide.secondaryCtaLabel}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Slide Navigation & Spec Indicator */}
          <div className="flex items-center justify-between gap-6 rounded-xl border border-white/15 bg-[#061229]/65 px-5 py-3.5 backdrop-blur-md text-white lg:min-w-[300px]">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-white/65">
                Slide 0{activeIndex + 1} / 0{slides.length}
              </p>
              <p className="mt-0.5 text-sm font-medium text-white tabular-nums">
                {currentSlide.startingPrice}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous hero slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white transition-colors hover:bg-white/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next hero slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 text-white transition-colors hover:bg-white/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Minimalist Slide Progress Bars */}
        <div className="mt-5 flex items-center gap-2" role="tablist" aria-label="Hero slide selection">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`View slide ${idx + 1}: ${slide.headline}`}
              onClick={() => setActiveIndex(idx)}
              className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                idx === activeIndex ? 'w-12 bg-white' : 'w-6 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
