/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { DedicatedBookingPage } from './components/BookingPageShell';
import { ContactSection } from './components/ContactSection';
import { DealershipModals } from './components/DealershipModals';
import { FinanceSection } from './components/FinanceSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import {
  PrivacyPolicyPage,
  SitemapPage,
  TermsPage,
} from './components/LegalAndSitemapPages';
import { MasterCarsSection } from './components/MasterCarsSection';
import { MotoringNewsSection } from './components/MotoringNewsSection';
import { Navbar } from './components/Navbar';
import {
  InventoryFilterMode,
  NewVehiclesSection,
} from './components/NewVehiclesSection';
import { ServicePartsSection } from './components/ServicePartsSection';
import { ShowroomInventoryView } from './components/ShowroomInventoryView';
import { StartingPointSection } from './components/StartingPointSection';
import { VwAlertEmergencyBar, VwAlertPage } from './components/VwAlertSection';
import { ROUTE_SEO_META } from './data/dealership';
import { AppRoute, ModalContextState, VehicleCategory } from './types/dealership';

const VALID_ROUTES: AppRoute[] = [
  '/',
  '/vehicles',
  '/specials',
  '/test-drive',
  '/service',
  '/parts',
  '/finance',
  '/vw-alert',
  '/news',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/sitemap',
];

function normalizeRoute(pathname: string): AppRoute {
  const lower = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return (VALID_ROUTES.includes(lower as AppRoute) ? lower : '/') as AppRoute;
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname)
  );
  const [activeCategory, setActiveCategory] = useState<VehicleCategory>('All');
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all');
  const [modal, setModal] = useState<ModalContextState>({ type: null });

  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const seo = ROUTE_SEO_META[currentRoute] ?? ROUTE_SEO_META['/'];
    document.title = seo.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', seo.description);
    }
  }, [currentRoute]);

  const navigateTo = (route: AppRoute) => {
    if (route !== currentRoute) {
      window.history.pushState({}, '', route);
      setCurrentRoute(route);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    if (currentRoute !== '/') {
      window.history.pushState({}, '', '/');
      setCurrentRoute('/');
      window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExploreModels = () => {
    setActiveCategory('All');
    setFilterMode('all');
    scrollToSection('new-vehicles');
  };

  const handleShowInStock = () => {
    setActiveCategory('All');
    setFilterMode('in-stock');
    scrollToSection('new-vehicles');
  };

  const renderPageContent = () => {
    switch (currentRoute) {
      case '/vehicles':
        return (
          <ShowroomInventoryView
            mode="vehicles"
            onBookTestDrive={(vehicleName) =>
              setModal({ type: 'test-drive', vehicleName })
            }
            onEnquireDeal={(item) =>
              setModal({
                type: 'vehicle-inquiry',
                vehicleName: item.title,
                vehiclePrice: item.price,
                dealSummary: item.dealSummary,
              })
            }
          />
        );
      case '/specials':
        return (
          <ShowroomInventoryView
            mode="specials"
            onBookTestDrive={(vehicleName) =>
              setModal({ type: 'test-drive', vehicleName })
            }
            onEnquireDeal={(item) =>
              setModal({
                type: 'vehicle-inquiry',
                vehicleName: item.title,
                vehiclePrice: item.price,
                dealSummary: item.dealSummary,
              })
            }
          />
        );
      case '/test-drive':
        return <DedicatedBookingPage mode="test-drive" />;
      case '/service':
        return <DedicatedBookingPage mode="service" />;
      case '/parts':
        return <DedicatedBookingPage mode="parts" />;
      case '/finance':
        return (
          <div className="pt-16">
            <FinanceSection
              onApplyFinance={(preset) =>
                setModal({
                  type: 'finance',
                  vehicleName: preset.vehicleName,
                  vehiclePrice: preset.vehiclePrice,
                  financePreset: preset,
                })
              }
            />
          </div>
        );
      case '/vw-alert':
        return (
          <VwAlertPage
            onNavigate={navigateTo}
            onBookService={() => setModal({ type: 'service' })}
          />
        );
      case '/news':
        return (
          <div className="pt-16">
            <MotoringNewsSection
              onSelectArticle={(article) =>
                setModal({ type: 'news-reader', article })
              }
            />
          </div>
        );
      case '/contact':
        return (
          <div className="pt-16">
            <ContactSection />
          </div>
        );
      case '/privacy-policy':
        return <PrivacyPolicyPage />;
      case '/terms':
        return <TermsPage />;
      case '/sitemap':
        return <SitemapPage onNavigate={navigateTo} />;
      case '/':
      default:
        return (
          <>
            <HeroSection
              onExploreModels={handleExploreModels}
              onBookTestDrive={(modelName) =>
                setModal({ type: 'test-drive', vehicleName: modelName })
              }
            />

            <VwAlertEmergencyBar onOpenVwAlert={() => navigateTo('/vw-alert')} />

            <StartingPointSection
              onExploreModels={handleExploreModels}
              onShowInStock={handleShowInStock}
              onBookTestDrive={() => setModal({ type: 'test-drive' })}
              onOpenFinance={() => scrollToSection('finance')}
              onScrollToContact={() => scrollToSection('contact')}
            />

            <NewVehiclesSection
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              filterMode={filterMode}
              onFilterModeChange={setFilterMode}
              onBookTestDrive={(vehicleName) =>
                setModal({ type: 'test-drive', vehicleName })
              }
              onRequestQuote={(vehicle) =>
                setModal({
                  type: 'vehicle-inquiry',
                  vehicleName: vehicle.name,
                  vehiclePrice: vehicle.priceFrom,
                  dealSummary: vehicle.specialOfferSummary,
                })
              }
            />

            <FinanceSection
              onApplyFinance={(preset) =>
                setModal({
                  type: 'finance',
                  vehicleName: preset.vehicleName,
                  vehiclePrice: preset.vehiclePrice,
                  financePreset: preset,
                })
              }
            />

            <ServicePartsSection
              onBookService={() => setModal({ type: 'service' })}
              onOrderParts={() => setModal({ type: 'parts' })}
            />

            <MotoringNewsSection
              onSelectArticle={(article) =>
                setModal({ type: 'news-reader', article })
              }
            />

            <MasterCarsSection
              onInquireVehicle={(listing) =>
                setModal({
                  type: 'vehicle-inquiry',
                  vehicleName: listing.title,
                  vehiclePrice: listing.price,
                })
              }
              onViewAllMasterCars={() => navigateTo('/vehicles')}
            />

            <ContactSection />
          </>
        );
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-[#091224] flex flex-col">
        <Navbar
          currentRoute={currentRoute}
          onNavigate={navigateTo}
          onOpenTestDrive={() => setModal({ type: 'test-drive' })}
        />

        <main className="flex-1">{renderPageContent()}</main>

        <Footer onNavigate={navigateTo} />

        <DealershipModals
          modal={modal}
          onClose={() => setModal({ type: null })}
        />
      </div>
    </MotionConfig>
  );
}
