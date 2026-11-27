import React from 'react';
import { ExternalLink, Facebook, Instagram, Youtube } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { toIntlPhoneDisplay, toTelHref } from '../lib/utils';
import { AppRoute, DealershipId } from '../types/dealership';
import { VolkswagenEmblem } from './Navbar';

interface FooterProps {
  onNavigate: (route: AppRoute) => void;
}

function buildBranchPreviewHref(branchId: DealershipId): string {
  if (typeof window === 'undefined') {
    return `/?branch=${branchId}`;
  }
  const url = new URL(window.location.origin);
  url.searchParams.set('branch', branchId);
  return url.toString();
}

export function Footer({ onNavigate }: FooterProps) {
  const { activeDealership, activeDealerships, groupProfile } = useDealership();
  const sisterDealerships = activeDealerships.filter((d) => d.id !== activeDealership.id);
  const socialLinks = [
    {
      label: 'Facebook',
      icon: Facebook,
      href: activeDealership.facebookUrl || '',
      ariaLabel: `${activeDealership.name} on Facebook`,
    },
    {
      label: 'Instagram',
      icon: Instagram,
      href: activeDealership.instagramUrl || '',
      ariaLabel: `${activeDealership.name} on Instagram`,
    },
    {
      label: 'YouTube',
      icon: Youtube,
      href: activeDealership.youtubeUrl || groupProfile.youtubeUrl || '',
      ariaLabel: `${groupProfile.groupName} on YouTube`,
    },
  ].filter((item) => Boolean(item.href));

  const linkButton = (label: string, route: AppRoute) => (
    <a
      href={route}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(route);
      }}
      className="hover:text-white transition-colors"
    >
      {label}
    </a>
  );

  return (
    <footer className="border-t border-[#E2E8F0] bg-[#091224] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand Column */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <VolkswagenEmblem inverted className="h-8 w-8" />
              <span className="font-display text-lg font-semibold tracking-tight">
                {activeDealership.name}
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              {activeDealership.legalEntity} trading as {activeDealership.name}. Authorised Financial Services Provider (FSP No. {activeDealership.fspNumber}) serving {activeDealership.city} and {activeDealership.province}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                {groupProfile.groupLogoSrc && (
                  <img
                    src={groupProfile.groupLogoSrc}
                    alt={`${groupProfile.groupName} Logo`}
                    className="h-9 w-9 rounded-full bg-white p-0.5 object-contain"
                  />
                )}
                <div className="text-xs">
                  <span className="block text-white/60">Dealership Group</span>
                  <span className="font-semibold text-white">
                    {groupProfile.groupName}
                  </span>
                </div>
              </div>

              {socialLinks.length > 0 && (
                <div className="flex items-center gap-2.5">
                  {socialLinks.map((social) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={social.label}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={social.ariaLabel}
                        aria-label={social.ariaLabel}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Showroom Links */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Showroom
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              <li>{linkButton('Group Showroom', '/vehicles')}</li>
              <li>{linkButton('Specials & Offers', '/specials')}</li>
              <li>{linkButton('Book Test Drive', '/test-drive')}</li>
              <li>{linkButton('News & Events', '/news-events')}</li>
            </ul>
          </div>

          {/* Ownership Links */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Ownership
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              <li>{linkButton('Vehicle Finance', '/finance')}</li>
              <li>{linkButton('Service & Parts', '/aftersales')}</li>
              <li>{linkButton('Volkswagen Alert', '/vw-alert')}</li>
              <li>{linkButton('Careers', '/careers')}</li>
              <li>{linkButton('Dealership Admin', '/admin')}</li>
            </ul>
          </div>

          {/* Address & Hours */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Branch &amp; Hours
            </h3>
            <address className="mt-4 space-y-1.5 text-sm not-italic text-white/80">
              <p>{activeDealership.physicalAddress}</p>
              <p>
                {activeDealership.city}, {activeDealership.province}
              </p>
              <p className="pt-1 font-mono text-white">
                <a href={toTelHref(activeDealership.receptionNumber)} className="hover:underline">
                  {toIntlPhoneDisplay(activeDealership.receptionNumber)}
                </a>
              </p>
              {activeDealership.whatsappNumber && (
                <p className="text-xs text-white/75 font-mono">
                  WhatsApp: {activeDealership.whatsappNumber}
                </p>
              )}
              <p className="text-xs text-white/65">Sales: {activeDealership.salesHours}</p>
              <p className="text-xs text-white/65">Service: {activeDealership.serviceHours}</p>
              <p className="text-xs text-white/75 pt-1">
                24/7 VW Alert:{' '}
                <a href={toTelHref(activeDealership.roadsideAssist)} className="font-mono underline">
                  {activeDealership.roadsideAssist}
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Multi-Branch Testing Switcher (Testing Purposes Only) */}
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-white/70">
            <span className="font-semibold text-white/90">Dealership Preview (Testing Only)</span>
            <span aria-hidden="true">·</span>
            <span>
              Viewing:{' '}
              <strong className="font-medium text-white">
                {activeDealership.name}
              </strong>{' '}
              <span className="font-mono text-white/60">({activeDealership.domain})</span>
            </span>
          </div>

          <nav
            aria-label="Test other dealership branches"
            className="flex flex-wrap items-center gap-5"
          >
            {sisterDealerships.map((sister) => (
              <a
                key={sister.id}
                href={buildBranchPreviewHref(sister.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-white/85 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white whitespace-nowrap shrink-0"
              >
                <span>Open {sister.name}</span>
                <span className="font-mono text-[11px] text-white/60">
                  (?branch={sister.id})
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-white/65" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {activeDealership.legalEntity} t/a {activeDealership.name} · Authorised FSP No. {activeDealership.fspNumber}. Prices exclude on-the-road costs (E&amp;OE).
          </p>

          <div className="flex flex-wrap items-center gap-5">
            {linkButton('Personal Information (POPIA)', '/privacy-policy')}
            {linkButton('Terms & Conditions', '/terms')}
            {linkButton('Contact Us', '/contact')}
            {linkButton('Sitemap', '/sitemap')}
            {linkButton('Admin CMS', '/admin')}
          </div>
        </div>
      </div>
    </footer>
  );
}
