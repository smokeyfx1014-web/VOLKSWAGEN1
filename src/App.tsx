/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AdminPortalPage } from './components/AdminPortalPage';
import { AftersalesPage } from './components/AftersalesPage';
import { DedicatedBookingPage } from './components/BookingPageShell';
import { CareersPage } from './components/CareersPage';
import { ContactSection } from './components/ContactSection';
import { DealershipModals } from './components/DealershipModals';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FinanceSection } from './components/FinanceSection';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { HomeOverviewHub } from './components/HomeOverviewHub';
import { HomePromotionsShowcase } from './components/HomePromotionsShowcase';
import {
  PrivacyPolicyPage,
  SitemapPage,
  TermsPage,
} from './components/LegalAndSitemapPages';
import { Navbar } from './components/Navbar';
import { NewsAndEventsPage } from './components/NewsAndEventsPage';
import { ShowroomInventoryView } from './components/ShowroomInventoryView';
import { VehicleSearchShowcase } from './components/VehicleSearchShowcase';
import { VwAlertEmergencyBar, VwAlertPage } from './components/VwAlertSection';
import { DealershipProvider, useDealership } from './context/DealershipContext';
import { DealershipDataProvider } from './context/DealershipDataContext';
import { getRouteSeoMeta } from './data/dealership';
import { AppRoute, CmsVehicle, ModalContextState } from './types/dealership';

const VALID_ROUTES: AppRoute[] = [
  '/',
  '/vehicles',
  '/specials',
  '/test-drive',
  '/aftersales',
  '/service',
  '/parts',
  '/finance',
  '/vw-alert',
  '/news-events',
  '/news',
  '/careers',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/sitemap',
  '/admin',
];

function normalizeRoute(pathname: string): AppRoute {
  const lower = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return (VALID_ROUTES.includes(lower as AppRoute) ? lower : '/') as AppRoute;
}

function DealershipShell() {
  const { activeDealership, groupProfile } = useDealership();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname)
  );
  const [modal, setModal] = useState<ModalContextState>({ type: null });

  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const seo = getRouteSeoMeta(currentRoute, activeDealership, groupProfile);
    document.title = seo.title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', seo.description);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', seo.title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', seo.description);
    }
  }, [currentRoute, activeDealership, groupProfile]);

  const navigateTo = (route: AppRoute) => {
    if (route !== currentRoute) {
      const currentParams = new URLSearchParams(window.location.search);
      const branchParam = currentParams.get('branch');
      const nextUrl = branchParam
        ? `${route}?branch=${encodeURIComponent(branchParam)}`
        : route;

      window.history.pushState({}, '', nextUrl);
      setCurrentRoute(route);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openFinanceForVehicle = (vehicle: CmsVehicle) =>
    setModal({
      type: 'finance',
      vehicleName: vehicle.title,
      vehiclePrice: vehicle.price,
      homeDealershipId: vehicle.homeDealershipId,
      financePreset: {
        vehiclePrice: vehicle.price,
        depositPercent: 10,
        balloonPercent: 30,
        termMonths: 72,
        monthlyEstimate: vehicle.monthlyFrom,
      },
    });

  const renderPageContent = () => {
    switch (currentRoute) {
      case '/vehicles':
        return (
          <ShowroomInventoryView
            mode="vehicles"
            onNavigate={navigateTo}
            onBookTestDrive={(vehicleName, homeDealershipId) =>
              setModal({ type: 'test-drive', vehicleName, homeDealershipId })
            }
            onEnquireDeal={(item) =>
              setModal({
                type: 'vehicle-inquiry',
                vehicleName: item.title,
                vehiclePrice: item.price,
                dealSummary: item.dealSummary,
                homeDealershipId: item.homeDealershipId,
              })
            }
            onApplyFinance={openFinanceForVehicle}
          />
        );
      case '/specials':
        return (
          <ShowroomInventoryView
            mode="specials"
            onBookTestDrive={(vehicleName, homeDealershipId) =>
              setModal({ type: 'test-drive', vehicleName, homeDealershipId })
            }
            onEnquireDeal={(item) =>
              setModal({
                type: 'vehicle-inquiry',
                vehicleName: item.title,
                vehiclePrice: item.price,
                dealSummary: item.dealSummary,
                homeDealershipId: item.homeDealershipId,
              })
            }
            onEnterCompetition={(competitionTitle) =>
              setModal({
                type: 'competition-entry',
                competitionTitle,
                homeDealershipId: activeDealership.id,
              })
            }
          />
        );
      case '/test-drive':
        return <DedicatedBookingPage mode="test-drive" />;
      case '/aftersales':
      case '/service':
        return <AftersalesPage initialTab="service" />;
      case '/parts':
        return <AftersalesPage initialTab="parts" />;
      case '/finance':
        return (
          <div className="pt-16">
            <FinanceSection
              onNavigate={navigateTo}
              onApplyFinance={(preset) =>
                setModal({
                  type: 'finance',
                  vehicleName: preset.vehicleName,
                  vehiclePrice: preset.vehiclePrice,
                  financePreset: preset,
                  homeDealershipId: activeDealership.id,
                })
              }
            />
          </div>
        );
      case '/vw-alert':
        return (
          <VwAlertPage
            onNavigate={navigateTo}
            onBookService={() => navigateTo('/aftersales')}
          />
        );
      case '/news-events':
      case '/news':
        return (
          <NewsAndEventsPage
            onSelectArticle={(article) =>
              setModal({ type: 'news-reader', article })
            }
            onRsvpEvent={(eventTitle, homeDealershipId) =>
              setModal({ type: 'event-rsvp', eventTitle, homeDealershipId })
            }
          />
        );
      case '/careers':
        return <CareersPage />;
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
      case '/admin':
        return <AdminPortalPage />;
      case '/':
      default:
        return (
          <>
            <HeroSection
              onExploreModels={() => navigateTo('/vehicles')}
              onBookTestDrive={(modelName) =>
                setModal({
                  type: 'test-drive',
                  vehicleName: modelName,
                  homeDealershipId: activeDealership.id,
                })
              }
            />

            <VwAlertEmergencyBar onOpenVwAlert={() => navigateTo('/vw-alert')} />

            <VehicleSearchShowcase
              variant="home"
              pageSize={6}
              onNavigate={navigateTo}
              onBookTestDrive={(vehicleName, homeDealershipId) =>
                setModal({ type: 'test-drive', vehicleName, homeDealershipId })
              }
              onEnquireDeal={(item) =>
                setModal({
                  type: 'vehicle-inquiry',
                  vehicleName: item.title,
                  vehiclePrice: item.price,
                  dealSummary: item.dealSummary,
                  homeDealershipId: item.homeDealershipId,
                })
              }
              onApplyFinance={openFinanceForVehicle}
            />

            <HomePromotionsShowcase
              onNavigate={navigateTo}
              onEnterCompetition={(competitionTitle, homeDealershipId) =>
                setModal({
                  type: 'competition-entry',
                  competitionTitle,
                  homeDealershipId: homeDealershipId ?? activeDealership.id,
                })
              }
              onEnquireDeal={(item) =>
                setModal({
                  type: 'vehicle-inquiry',
                  vehicleName: item.title,
                  vehiclePrice: item.price,
                  dealSummary: item.dealSummary,
                  homeDealershipId: item.homeDealershipId,
                })
              }
              onBookTestDrive={(vehicleName, homeDealershipId) =>
                setModal({
                  type: 'test-drive',
                  vehicleName,
                  homeDealershipId: homeDealershipId ?? activeDealership.id,
                })
              }
            />

            <HomeOverviewHub onNavigate={navigateTo} />
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
          onOpenTestDrive={() =>
            setModal({ type: 'test-drive', homeDealershipId: activeDealership.id })
          }
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

export default function App() {
  return (
    <ErrorBoundary>
      <DealershipProvider>
        <DealershipDataProvider>
          <DealershipShell />
        </DealershipDataProvider>
      </DealershipProvider>
    </ErrorBoundary>
  );
}
