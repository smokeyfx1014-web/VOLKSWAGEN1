import React, { useEffect, useState } from 'react';
import { Menu, MessageCircle, Phone, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEALERSHIP_INFO } from '../data/dealership';
import { AppRoute } from '../types/dealership';
import { Button, Sheet } from './ui/shadcn';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenTestDrive: () => void;
}

const NAV_LINKS: { label: string; route: AppRoute }[] = [
  { label: 'New Vehicles', route: '/vehicles' },
  { label: 'Specials', route: '/specials' },
  { label: 'Finance', route: '/finance' },
  { label: 'Service', route: '/service' },
  { label: 'Parts', route: '/parts' },
  { label: 'Contact', route: '/contact' },
];

export function VolkswagenEmblem({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <img
      src="/assets/aistudio/vw-logo_3bdead53.png"
      alt="Volkswagen Logo"
      className={cn(
        'h-8 w-8 shrink-0 object-contain transition-all duration-200',
        inverted && 'brightness-0 invert',
        className
      )}
    />
  );
}

export function Navbar({ currentRoute, onNavigate, onOpenTestDrive }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 28);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solidHeader = scrolled || currentRoute !== '/';

  const handleLinkClick = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-40 transition-all duration-200',
          solidHeader
            ? 'bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] text-[#091224] shadow-xs'
            : 'bg-linear-to-b from-[#001E50]/75 to-transparent text-white border-b border-white/10'
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('/');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A] rounded-md"
          >
            <VolkswagenEmblem inverted={!solidHeader} />
            <span className="font-display text-base sm:text-lg font-semibold tracking-tight">
              Newcastle Volkswagen
            </span>
          </a>

          {/* Zone 2: Primary Single-Line Navigation */}
          <nav
            aria-label="Primary dealership navigation"
            className="hidden lg:flex items-center gap-7"
          >
            {NAV_LINKS.map((link) => {
              const isActive = currentRoute === link.route;
              return (
                <a
                  key={link.route}
                  href={link.route}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(link.route);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:transition-all after:duration-200 hover:after:w-full',
                    isActive ? 'after:w-full' : 'after:w-0',
                    solidHeader
                      ? 'text-[#334155] hover:text-[#001E50] after:bg-[#001E50]'
                      : 'text-white/90 hover:text-white after:bg-white',
                    isActive && solidHeader && 'text-[#001E50] font-semibold'
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant={solidHeader ? 'primary' : 'glass'}
              size="sm"
              onClick={onOpenTestDrive}
              className="hidden sm:inline-flex"
            >
              Book Test Drive
            </Button>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg lg:hidden transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00437A]',
                solidHeader
                  ? 'text-[#091224] hover:bg-[#F1F5F9]'
                  : 'text-white hover:bg-white/15'
              )}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-center gap-2.5 text-[#001E50]">
            <VolkswagenEmblem className="h-7 w-7" />
            <span className="font-display text-base font-semibold tracking-tight">
              Newcastle Volkswagen
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#091224] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-6" aria-label="Mobile dealership navigation">
          <ul className="space-y-1">
            <li>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick('/');
                }}
                className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-[#091224] transition-colors hover:bg-[#F8FAFC] hover:text-[#001E50]"
              >
                Home
              </a>
            </li>
            {NAV_LINKS.map((link) => (
              <li key={link.route}>
                <a
                  href={link.route}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(link.route);
                  }}
                  className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-[#091224] transition-colors hover:bg-[#F8FAFC] hover:text-[#001E50]"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="/vw-alert"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick('/vw-alert');
                }}
                className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-[#091224] transition-colors hover:bg-[#F8FAFC] hover:text-[#001E50]"
              >
                Volkswagen Alert (24/7)
              </a>
            </li>
            <li>
              <a
                href="/news"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick('/news');
                }}
                className="flex h-11 items-center rounded-lg px-3 text-base font-medium text-[#091224] transition-colors hover:bg-[#F8FAFC] hover:text-[#001E50]"
              >
                Motoring News
              </a>
            </li>
            <li>
              <a
                href="/sitemap"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick('/sitemap');
                }}
                className="flex h-11 items-center rounded-lg px-3 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#001E50]"
              >
                Sitemap
              </a>
            </li>
          </ul>
        </nav>

        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              setMobileOpen(false);
              onOpenTestDrive();
            }}
          >
            Book Test Drive
          </Button>
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={DEALERSHIP_INFO.phoneHref}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#001E50]"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{DEALERSHIP_INFO.phone}</span>
            </a>
            <a
              href={DEALERSHIP_INFO.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#001E50]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </Sheet>
    </>
  );
}
