import React from 'react';
import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { DEALERSHIP_INFO } from '../data/dealership';
import { AppRoute } from '../types/dealership';
import { VolkswagenEmblem } from './Navbar';

interface FooterProps {
  onNavigate: (route: AppRoute) => void;
}

export function Footer({ onNavigate }: FooterProps) {
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
                Newcastle Volkswagen
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              {DEALERSHIP_INFO.legalEntity} trading as {DEALERSHIP_INFO.name}. Authorised Financial Services Provider (FSP No. {DEALERSHIP_INFO.fspNumber}) serving Newcastle and Northern KwaZulu-Natal.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                <img
                  src={DEALERSHIP_INFO.groupLogoSrc}
                  alt="Docrat Group Logo"
                  className="h-9 w-9 rounded-full bg-white p-0.5 object-contain"
                />
                <div className="text-xs">
                  <span className="block text-white/60">Dealership Group</span>
                  <span className="font-semibold text-white">{DEALERSHIP_INFO.groupName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {[
                  { label: 'Facebook', icon: Facebook },
                  { label: 'Instagram', icon: Instagram },
                  { label: 'LinkedIn', icon: Linkedin },
                  { label: 'YouTube', icon: Youtube },
                ].map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href="/contact"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate('/contact');
                      }}
                      aria-label={`Newcastle Volkswagen on ${social.label}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white/75 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Showroom Links */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Showroom
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              <li>{linkButton('New & Used Vehicles', '/vehicles')}</li>
              <li>{linkButton('Monthly Specials', '/specials')}</li>
              <li>{linkButton('Book Test Drive', '/test-drive')}</li>
              <li>{linkButton('Motoring News', '/news')}</li>
            </ul>
          </div>

          {/* Ownership Links */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Ownership
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/80">
              <li>{linkButton('Vehicle Finance', '/finance')}</li>
              <li>{linkButton('Service Bookings', '/service')}</li>
              <li>{linkButton('Genuine Parts', '/parts')}</li>
              <li>{linkButton('Volkswagen Alert', '/vw-alert')}</li>
            </ul>
          </div>

          {/* Address & Hours */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-semibold tracking-wider text-white/60 uppercase">
              Dealership & Hours
            </h3>
            <address className="mt-4 space-y-1.5 text-sm not-italic text-white/80">
              <p>{DEALERSHIP_INFO.street}</p>
              <p>
                {DEALERSHIP_INFO.city}, {DEALERSHIP_INFO.province}
              </p>
              <p className="pt-1 font-mono text-white">
                <a href={DEALERSHIP_INFO.phoneHref} className="hover:underline">
                  {DEALERSHIP_INFO.phoneIntl}
                </a>
              </p>
              <p className="text-xs text-white/65">
                Sales: Mon–Fri 08:00–17:00 · Sat 08:00–12:00
              </p>
              <p className="text-xs text-white/65">
                Service & Parts: Mon–Fri 07:30–17:00
              </p>
              <p className="text-xs text-white/75 pt-1">
                24/7 VW Alert:{' '}
                <a href="tel:0860434737" className="font-mono underline">
                  {DEALERSHIP_INFO.vwAlert}
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {DEALERSHIP_INFO.legalEntity} t/a {DEALERSHIP_INFO.name} · Authorised FSP No. {DEALERSHIP_INFO.fspNumber}. Prices exclude on-the-road costs (E&OE).
          </p>

          <div className="flex flex-wrap items-center gap-5">
            {linkButton('Personal Information (POPIA)', '/privacy-policy')}
            {linkButton('Terms & Conditions', '/terms')}
            {linkButton('Contact Us', '/contact')}
            {linkButton('Sitemap', '/sitemap')}
          </div>
        </div>
      </div>
    </footer>
  );
}
