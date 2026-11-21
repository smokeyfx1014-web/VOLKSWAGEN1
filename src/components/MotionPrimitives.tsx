import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface FadeUpProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function FadeUp({ children, delay = 0, className }: FadeUpProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.45,
        delay: shouldReduceMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  kicker,
  title,
  description,
  align = 'left',
}: {
  kicker: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  return (
    <FadeUp className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-semibold tracking-wider text-[#00437A] uppercase">{kicker}</p>
      <h2 className="mt-2.5 text-3xl sm:text-4xl font-semibold tracking-tight text-[#091224] text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-3.5 text-base leading-relaxed text-[#475569]">{description}</p>
      )}
    </FadeUp>
  );
}
