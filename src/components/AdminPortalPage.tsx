import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  ExternalLink,
  Globe,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Newspaper,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { DEALERSHIP_IMAGE_LIBRARY, GROUP_CORPORATE_INFO } from '../data/dealership';
import { cn, formatZAR, toGoogleMapsEmbedUrl } from '../lib/utils';
import {
  AutoTraderSyncReport,
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipId,
  DealershipRecord,
  PromotionScope,
  PromotionType,
  VehicleStatus,
} from '../types/dealership';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

type AdminTab = 'overview' | 'vehicles' | 'promotions' | 'branches' | 'news' | 'leads';
type VisibilityChoice = 'MASTER' | DealershipId;

function formatSyncTimestamp(value: unknown): string {
  if (!value) return '—';
  try {
    let date: Date | null = null;
    if (value instanceof Date) {
      date = value;
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (value as { toDate: () => Date }).toDate();
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    }
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function addDaysISO(baseISO: string, days: number): string {
  const date = new Date(`${baseISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function ImageSourceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Choose Dealership Image Preset</Label>
          <Select
            value={
              DEALERSHIP_IMAGE_LIBRARY.some((item) => item.src === value) ? value : 'custom'
            }
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                onChange(e.target.value);
              }
            }}
          >
            {DEALERSHIP_IMAGE_LIBRARY.map((item) => (
              <option key={item.src} value={item.src}>
                {item.category}: {item.label}
              </option>
            ))}
            <option value="custom">Custom URL / Path</option>
          </Select>
        </div>
        <div>
          <Label>Or Enter Image URL / Path *</Label>
          <Input
            value={value}
            placeholder="/assets/... or https://..."
            onChange={(e) => onChange(e.target.value)}
            required
          />
        </div>
      </div>
      {value && (
        <div className="h-28 w-48 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F1F5F9]">
          <img
            src={value}
            alt="Preview"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export function AdminPortalPage() {
  const {
    activeDealership,
    dealershipsById,
    allDealerships,
    switchPreviewBranch,
    saveDealershipSettings,
  } = useDealership();

  const {
    todayISO,
    user,
    authReady,
    isAdmin,
    authError,
    signInAdmin,
    signOutAdmin,
    activeVehicles,
    allVehicles,
    activePromotions,
    allPromotions,
    archivedPromotions,
    allNews,
    leads,
    usingFallbackSeed,
    seedAllDefaultData,
    saveVehicle,
    deleteVehicle,
    clearManualVehicles,
    syncAutoTraderFromDecodo,
    importAutoTraderJson,
    savePromotion,
    archivePromotion,
    reactivatePromotion,
    deletePromotion,
    saveNews,
    deleteNews,
    updateLeadStatus,
    deleteLead,
  } = useDealershipData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleBranchFilter, setVehicleBranchFilter] = useState<'All' | DealershipId>('All');
  const [promoSubTab, setPromoSubTab] = useState<'active' | 'archived'>('active');
  const [promoTypeFilter, setPromoTypeFilter] = useState<'all' | PromotionType>('all');
  const [promoScopeFilter, setPromoScopeFilter] = useState<'all' | 'MASTER' | DealershipId>('all');
  const [leadBranchFilter, setLeadBranchFilter] = useState<'All' | DealershipId>('All');

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // AutoTrader Sync & JSON Import state
  const [syncingAutoTrader, setSyncingAutoTrader] = useState(false);
  const [syncReport, setSyncReport] = useState<AutoTraderSyncReport | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showJsonImportModal, setShowJsonImportModal] = useState(false);
  const [jsonImportRaw, setJsonImportRaw] = useState('');
  const [jsonImportBranchId, setJsonImportBranchId] = useState<DealershipId>(activeDealership.id);
  const [jsonImportReconcile, setJsonImportReconcile] = useState(false);
  const [branchSaveError, setBranchSaveError] = useState<string | null>(null);

  // Modal editors
  const [editingVehicle, setEditingVehicle] = useState<
    (Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { extraImagesText: string }) | null
  >(null);
  const [editingPromo, setEditingPromo] = useState<
    (Omit<CmsPromotion, 'updatedAt' | 'updatedBy'> & { visibilityChoice: VisibilityChoice }) | null
  >(null);
  const [editingNews, setEditingNews] = useState<
    Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'> | null
  >(null);

  // Reactivate archived promotion modal
  const [reactivatingPromo, setReactivatingPromo] = useState<CmsPromotion | null>(null);
  const [reactivateExpiryDate, setReactivateExpiryDate] = useState(() => addDaysISO(todayISO, 30));

  // Branch Settings editor state
  const [selectedBranchId, setSelectedBranchId] = useState<DealershipId>(activeDealership.id);
  const [branchDraft, setBranchDraft] = useState<DealershipRecord>(
    dealershipsById[activeDealership.id]
  );

  useEffect(() => {
    setBranchDraft(dealershipsById[selectedBranchId]);
  }, [selectedBranchId, dealershipsById]);

  const showFlash = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => setStatusNotice(null), 5000);
  };

  const livePromotionsList = useMemo(
    () =>
      allPromotions
        .filter((p) => p.active && p.validUntil >= todayISO)
        .sort((a, b) => a.validUntil.localeCompare(b.validUntil)),
    [allPromotions, todayISO]
  );

  const manualVehiclesCount = useMemo(
    () =>
      allVehicles.filter((v) => v.source !== 'autotrader' && !v.id.startsWith('at_')).length,
    [allVehicles]
  );

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allVehicles.filter((v) => {
      if (vehicleBranchFilter !== 'All' && v.homeDealershipId !== vehicleBranchFilter) {
        return false;
      }
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.status.toLowerCase().includes(q)
      );
    });
  }, [allVehicles, vehicleBranchFilter, searchQuery]);

  const filteredPromotions = useMemo(() => {
    const base = promoSubTab === 'active' ? livePromotionsList : archivedPromotions;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((p) => {
      if (promoTypeFilter !== 'all' && p.type !== promoTypeFilter) return false;
      if (promoScopeFilter === 'MASTER' && p.scope !== 'MASTER') return false;
      if (
        promoScopeFilter !== 'all' &&
        promoScopeFilter !== 'MASTER' &&
        (p.scope !== 'BRANCH' || p.dealershipId !== promoScopeFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.vehicleName.toLowerCase().includes(q)
      );
    });
  }, [
    promoSubTab,
    livePromotionsList,
    archivedPromotions,
    promoTypeFilter,
    promoScopeFilter,
    searchQuery,
  ]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allNews.filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q)
    );
  }, [allNews, searchQuery]);

  const sortedLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...leads]
      .filter((l) => {
        if (leadBranchFilter !== 'All' && l.submittedAtDealershipId !== leadBranchFilter) {
          return false;
        }
        if (!q) return true;
        return (
          l.fullName.toLowerCase().includes(q) ||
          l.subject.toLowerCase().includes(q) ||
          l.leadType.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.status === 'new' && b.status !== 'new' ? -1 : 0));
  }, [leads, leadBranchFilter, searchQuery]);

  if (!authReady) {
    return (
      <div className="min-h-[75vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-8 py-6 text-sm text-[#475569]">
          Verifying {GROUP_CORPORATE_INFO.legalEntity} administrator session...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-[80vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A]">
              {GROUP_CORPORATE_INFO.legalEntity} · FSP {GROUP_CORPORATE_INFO.fspNumber}
            </p>
            <h1 className="font-display text-2xl font-semibold text-[#091224]">
              Group Dealership Admin CMS
            </h1>
            <p className="text-sm leading-relaxed text-[#475569]">
              Sign in to manage Master Group stock across Newcastle VW, Ermelo VW, and Vryheid VW, publish scoped promotions &amp; events, configure branch details, and review customer leads.
            </p>
          </div>

          {user && !isAdmin && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
                <span>Account Not Authorized</span>
              </div>
              <p>
                Signed in as <strong className="font-mono">{user.email}</strong>. Only authorized {GROUP_CORPORATE_INFO.legalEntity} administrators can modify dealership data.
              </p>
            </div>
          )}

          {authError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            {!user ? (
              <Button size="lg" className="w-full" onClick={() => void signInAdmin()}>
                <LogIn className="h-4 w-4" />
                <span>Sign in with Google</span>
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => void signOutAdmin()}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
                <Button className="flex-1" onClick={() => void signInAdmin()}>
                  <span>Switch Account</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSeedAll = async () => {
    setBusyAction(true);
    try {
      await seedAllDefaultData();
      showFlash('Default 3-branch settings, Master Stock, Promotions, and News synced to Firestore.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Admin Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A]">
              {GROUP_CORPORATE_INFO.legalEntity} · FSP {GROUP_CORPORATE_INFO.fspNumber}
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#091224]">
              Multi-Branch Group Admin Portal
            </h1>
            <p className="mt-1 text-xs text-[#475569]">
              Signed in as <span className="font-mono text-[#091224]">{user.email}</span> · Previewing{' '}
              <strong className="text-[#001E50]">{activeDealership.name}</strong> (ID {activeDealership.id})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              disabled={busyAction}
              onClick={() => void handleSeedAll()}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Seed / Reset Default Group Data</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => void signOutAdmin()}>
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {usingFallbackSeed && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span>
              Firestore catalog collections are currently empty and displaying built-in fallback data. Click <strong>Seed / Reset Default Group Data</strong> to populate Firestore.
            </span>
          </div>
        )}

        {statusNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Navigation Tabs & Search */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white p-1.5">
            {[
              { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
              {
                id: 'vehicles' as const,
                label: `Master Stock (${allVehicles.length})`,
                icon: Car,
              },
              {
                id: 'promotions' as const,
                label: `Promotions & Events (${allPromotions.length})`,
                icon: Sparkles,
              },
              {
                id: 'branches' as const,
                label: 'Branch Settings (3)',
                icon: Building2,
              },
              { id: 'news' as const, label: `News (${allNews.length})`, icon: Newspaper },
              { id: 'leads' as const, label: `Leads (${leads.length})`, icon: Inbox },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224] hover:bg-[#F8FAFC]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'overview' && activeTab !== 'branches' && (
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="pl-9 bg-white"
              />
            </div>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: 'Available Master Stock',
                  value: `${activeVehicles.length} / ${allVehicles.length}`,
                  sub: 'Shared across Newcastle, Ermelo & Vryheid',
                },
                {
                  label: 'Live Promotions & Events',
                  value: `${livePromotionsList.length}`,
                  sub: `${archivedPromotions.length} archived or expired`,
                },
                {
                  label: 'Viewing Active Branch',
                  value: `${activePromotions.length} live on ${activeDealership.shortName}`,
                  sub: 'Includes MASTER + Branch-scoped items',
                },
                {
                  label: 'Customer Leads',
                  value: `${leads.length}`,
                  sub: `${leads.filter((l) => l.status === 'new').length} awaiting follow-up`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-2"
                >
                  <p className="text-xs font-medium text-[#64748B]">{stat.label}</p>
                  <p className="font-mono text-2xl font-semibold text-[#001E50]">{stat.value}</p>
                  <p className="text-xs text-[#475569]">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* 3 Dealership Quick Cards + Live Preview Switcher */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#091224]">
                    Asaf Auto Sales Group — Active Dealership Domains
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Click <strong>Preview Branch</strong> to switch `?branch=` immediately on this staging/localhost build.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('branches')}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Branch Settings</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {allDealerships.map((branch) => {
                  const isCurrent = branch.id === activeDealership.id;
                  const heldStockCount = allVehicles.filter(
                    (v) => v.homeDealershipId === branch.id && v.status === 'available'
                  ).length;
                  const exclusivePromos = livePromotionsList.filter(
                    (p) => p.scope === 'BRANCH' && p.dealershipId === branch.id
                  ).length;

                  return (
                    <div
                      key={branch.id}
                      className={cn(
                        'rounded-xl border p-5 space-y-3',
                        isCurrent ? 'border-[#001E50] bg-[#F8FAFC]' : 'border-[#E2E8F0] bg-white'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                            Branch ID {branch.id} · {branch.domain}
                          </span>
                          <h3 className="font-display text-base font-semibold text-[#091224]">
                            {branch.name}
                          </h3>
                        </div>
                        {isCurrent && (
                          <span className="rounded bg-[#001E50] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#475569] space-y-1">
                        <p>{branch.physicalAddress}</p>
                        <p className="font-mono">{branch.receptionNumber}</p>
                        {branch.whatsappNumber && (
                          <p className="font-mono text-emerald-700">
                            WhatsApp: {branch.whatsappNumber}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs">
                        <span className="text-[#475569]">
                          {heldStockCount} units · {exclusivePromos} branch promos
                        </span>
                        <Button
                          variant={isCurrent ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => {
                            switchPreviewBranch(branch.id);
                            showFlash(`Switched live preview to ${branch.name} (?branch=${branch.id}).`);
                          }}
                        >
                          {isCurrent ? 'Previewing' : 'Preview Branch'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MASTER GROUP STOCK (VEHICLES) TAB */}
        {activeTab === 'vehicles' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  Master Group Stock (New, Used &amp; MasterCars)
                </h2>
                <Select
                  value={vehicleBranchFilter}
                  onChange={(e) => setVehicleBranchFilter(e.target.value as 'All' | DealershipId)}
                  className="w-52 bg-white"
                >
                  <option value="All">All Holding Branches</option>
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      Held at {b.shortName} (ID {b.id})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="outline"
                  disabled={syncingAutoTrader}
                  onClick={async () => {
                    setSyncingAutoTrader(true);
                    setSyncError(null);
                    try {
                      const report = await syncAutoTraderFromDecodo();
                      setSyncReport(report);
                      showFlash('AutoTrader stock sync completed across configured branches.');
                    } catch (err) {
                      setSyncError(
                        err instanceof Error
                          ? err.message
                          : 'Unable to sync AutoTrader listings right now.'
                      );
                    } finally {
                      setSyncingAutoTrader(false);
                    }
                  }}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', syncingAutoTrader && 'animate-spin')}
                  />
                  <span>
                    {syncingAutoTrader ? 'Syncing AutoTrader...' : 'Sync AutoTrader Stock Now'}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setJsonImportBranchId(
                      vehicleBranchFilter === 'All' ? activeDealership.id : vehicleBranchFilter
                    );
                    setSyncError(null);
                    setShowJsonImportModal(true);
                  }}
                >
                  <Upload className="h-4 w-4" />
                  <span>Paste AutoTrader JSON</span>
                </Button>

                {manualVehiclesCount > 0 && (
                  <Button
                    variant="outline"
                    disabled={busyAction}
                    onClick={async () => {
                      setBusyAction(true);
                      try {
                        const removed = await clearManualVehicles();
                        showFlash(
                          `Removed ${removed} manually added ${removed === 1 ? 'vehicle' : 'vehicles'} from Master Group Stock.`
                        );
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span>Remove Manual Cars ({manualVehiclesCount})</span>
                  </Button>
                )}

                <Button
                  onClick={() =>
                    setEditingVehicle({
                      id: `veh-${Date.now()}`,
                      title: '',
                      make: 'Volkswagen',
                      model: '',
                      year: 2026,
                      price: 399900,
                      monthlyFrom: 5990,
                      mileage: 0,
                      transmission: '7-Speed DSG',
                      fuelType: 'Petrol',
                      category: 'New',
                      bodyStyle: 'SUVs',
                      powerKw: 'N/A',
                      fuelEconomy: 'VW Spec',
                      colour: 'Pure White',
                      images: ['/assets/aistudio/vwslider10_5974d4ed.jpg'],
                      homeDealershipId: activeDealership.id,
                      status: 'available',
                      source: 'manual',
                      extraImagesText: '',
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Vehicle to Group Stock</span>
                </Button>
              </div>
            </div>

            {syncError && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">AutoTrader Live Scrape Notice</p>
                    <p>{syncError}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSyncError(null);
                    setShowJsonImportModal(true);
                  }}
                >
                  Open JSON Importer
                </Button>
              </div>
            )}

            {syncReport && (
              <div className="rounded-xl border border-[#001E50]/20 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#001E50]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <span>
                      AutoTrader Sync Summary (
                      {syncReport.mode === 'decodo' ? 'Decodo Live Scrape' : 'JSON Import'})
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B]">
                    {formatSyncTimestamp(syncReport.syncedAtIso)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {syncReport.branches.map((b) => (
                    <div
                      key={b.branchId}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1"
                    >
                      <p className="font-semibold text-[#091224]">
                        {b.branchName} {b.dealerId ? `(#${b.dealerId})` : ''}
                      </p>
                      {b.skipped ? (
                        <p className="text-[#64748B]">{b.skipReason || 'Skipped'}</p>
                      ) : b.error ? (
                        <p className="text-red-700">{b.error}</p>
                      ) : (
                        <p className="font-mono text-[#334155]">
                          +{b.addedCount} added · {b.updatedCount} updated · {b.markedSoldCount}{' '}
                          marked sold
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Holding Branch</th>
                    <th className="px-4 py-3">Source &amp; Last Synced</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredVehicles.map((v) => {
                    const homeBranch = dealershipsById[v.homeDealershipId];
                    const isAutoTrader = v.source === 'autotrader' || v.id.startsWith('at_');
                    return (
                      <tr key={v.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={v.images[0]}
                              alt={v.title}
                              referrerPolicy="no-referrer"
                              className="h-12 w-16 rounded-md object-cover border border-[#E2E8F0] shrink-0"
                            />
                            <div>
                              <p className="font-semibold text-[#091224]">{v.title}</p>
                              <p className="text-xs text-[#64748B]">
                                {v.model} · {v.year} · {v.mileage.toLocaleString('en-ZA')} km ·{' '}
                                {v.category}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#001E50]/5 px-2 py-1 text-xs font-medium text-[#001E50]">
                            <MapPin className="h-3 w-3" />
                            {homeBranch?.shortName} (ID {v.homeDealershipId})
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold',
                                  isAutoTrader
                                    ? 'bg-blue-50 text-[#00437A]'
                                    : 'bg-slate-100 text-[#334155]'
                                )}
                              >
                                {isAutoTrader ? 'AutoTrader' : 'Manual Entry'}
                              </span>
                              {v.canonicalUrl && (
                                <a
                                  href={v.canonicalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open AutoTrader listing"
                                  className="text-[#00437A] hover:text-[#001E50]"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            <p className="inline-flex items-center gap-1 font-mono text-[11px] text-[#64748B]">
                              <Clock className="h-3 w-3" />
                              {formatSyncTimestamp(v.lastSyncedAt ?? v.updatedAt)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <p className="font-semibold text-[#091224]">{formatZAR(v.price)}</p>
                          <p className="text-[#00437A]">{formatZAR(v.monthlyFrom)} p/m</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize',
                              v.status === 'available'
                                ? 'bg-emerald-50 text-emerald-800'
                                : v.status === 'reserved'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setEditingVehicle({
                                  ...v,
                                  extraImagesText: v.images.slice(1).join('\n'),
                                })
                              }
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await deleteVehicle(v.id);
                                showFlash(`Removed ${v.title} from Master Group Stock.`);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCOPED PROMOTIONS, EVENTS & COMPETITIONS TAB */}
        {activeTab === 'promotions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPromoSubTab('active')}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer',
                      promoSubTab === 'active'
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:text-[#091224]'
                    )}
                  >
                    Live ({livePromotionsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoSubTab('archived')}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer',
                      promoSubTab === 'archived'
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:text-[#091224]'
                    )}
                  >
                    Archived / Expired ({archivedPromotions.length})
                  </button>
                </div>

                <Select
                  value={promoTypeFilter}
                  onChange={(e) => setPromoTypeFilter(e.target.value as 'all' | PromotionType)}
                  className="w-44 bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="special">Specials</option>
                  <option value="event">Events</option>
                  <option value="competition">Competitions</option>
                </Select>

                <Select
                  value={promoScopeFilter}
                  onChange={(e) =>
                    setPromoScopeFilter(e.target.value as 'all' | 'MASTER' | DealershipId)
                  }
                  className="w-56 bg-white"
                >
                  <option value="all">All Visibility Scopes</option>
                  <option value="MASTER">All Dealerships (Master)</option>
                  <option value="1">Newcastle VW Only (ID 1)</option>
                  <option value="2">Ermelo VW Only (ID 2)</option>
                  <option value="3">Vryheid VW Only (ID 3)</option>
                </Select>
              </div>

              <Button
                onClick={() =>
                  setEditingPromo({
                    id: `promo-${Date.now()}`,
                    title: '',
                    type: 'special',
                    description: '',
                    imageUrl: '/assets/aistudio/vwslider10_5974d4ed.jpg',
                    validUntil: addDaysISO(todayISO, 30),
                    scope: 'MASTER',
                    dealershipId: null,
                    active: true,
                    vehicleName: '',
                    offerPrice: 0,
                    monthlyFrom: 0,
                    eventTime: '',
                    location: 'All Asaf Auto Sales VW Branches',
                    visibilityChoice: 'MASTER',
                  })
                }
              >
                <Plus className="h-4 w-4" />
                <span>Add Special / Event / Competition</span>
              </Button>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-3.5 text-xs text-[#475569]">
              Campaigns whose <strong>Valid Until</strong> date is before today (
              <span className="font-mono text-[#091224]">{todayISO}</span>) are automatically archived and removed from public dealership sites. Use <strong>Bring Back with New Date</strong> on archived items to relaunch them.
            </div>

            {filteredPromotions.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#475569]">
                No promotions match your current tab or filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredPromotions.map((promo) => {
                  const visibilityLabel =
                    promo.scope === 'MASTER'
                      ? 'All Dealerships (Master)'
                      : `${dealershipsById[promo.dealershipId ?? '1']?.shortName} Only (ID ${promo.dealershipId})`;

                  return (
                    <div
                      key={promo.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
                    >
                      <div className="relative h-40 w-full bg-[#F1F5F9]">
                        <img
                          src={promo.imageUrl}
                          alt={promo.title}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute top-2.5 left-2.5 rounded bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[#001E50] uppercase shadow-xs">
                          {promo.type}
                        </span>
                        <span className="absolute top-2.5 right-2.5 rounded bg-[#001E50] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {visibilityLabel}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="font-display text-base font-semibold text-[#091224]">
                            {promo.title}
                          </h3>
                          {promo.vehicleName && (
                            <p className="text-xs font-medium text-[#00437A]">{promo.vehicleName}</p>
                          )}
                          <p className="text-xs text-[#475569] line-clamp-3">{promo.description}</p>
                          <div className="pt-2 font-mono text-xs text-[#334155] space-y-0.5">
                            <p>Valid Until: {promo.validUntil}</p>
                            {promo.offerPrice > 0 && (
                              <p>
                                Offer: {formatZAR(promo.offerPrice)}
                                {promo.monthlyFrom > 0 ? ` · ${formatZAR(promo.monthlyFrom)} p/m` : ''}
                              </p>
                            )}
                            {promo.eventTime && <p>Time: {promo.eventTime}</p>}
                            {promo.location && <p>Location: {promo.location}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditingPromo({
                                  ...promo,
                                  visibilityChoice:
                                    promo.scope === 'MASTER' ? 'MASTER' : promo.dealershipId ?? '1',
                                })
                              }
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>

                            {promoSubTab === 'active' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await archivePromotion(promo.id);
                                  showFlash(`Archived "${promo.title}".`);
                                }}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                <span>Archive</span>
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReactivatingPromo(promo);
                                  setReactivateExpiryDate(addDaysISO(todayISO, 30));
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Bring Back</span>
                              </Button>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await deletePromotion(promo.id);
                              showFlash(`Deleted "${promo.title}".`);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BRANCH SETTINGS TAB */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {allDealerships.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer',
                      selectedBranchId === branch.id
                        ? 'bg-[#001E50] text-white'
                        : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#001E50]'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>
                      ID {branch.id}: {branch.shortName}
                    </span>
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  switchPreviewBranch(selectedBranchId);
                  showFlash(`Site preview switched to ${branchDraft.name} (?branch=${selectedBranchId}).`);
                }}
              >
                Preview {branchDraft.shortName} Live Site
              </Button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusyAction(true);
                setBranchSaveError(null);
                try {
                  await saveDealershipSettings(branchDraft);
                  showFlash(`Saved live Firestore settings for ${branchDraft.name} (ID ${branchDraft.id}).`);
                } catch (err) {
                  setBranchSaveError(
                    err instanceof Error ? err.message : 'Unable to save branch settings.'
                  );
                } finally {
                  setBusyAction(false);
                }
              }}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#091224]">
                    {branchDraft.name} Configuration (Document ID: {branchDraft.id})
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Updates apply immediately to the navbar, footer, contact page, maps, SEO titles, and lead routing for {branchDraft.domain}.
                  </p>
                </div>
                <Button type="submit" disabled={busyAction}>
                  <Save className="h-4 w-4" />
                  <span>Save Branch Settings</span>
                </Button>
              </div>

              {branchSaveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {branchSaveError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Dealership Display Name *</Label>
                  <Input
                    value={branchDraft.name}
                    onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Short Name *</Label>
                  <Input
                    value={branchDraft.shortName}
                    onChange={(e) => setBranchDraft({ ...branchDraft, shortName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Production Domain *</Label>
                  <Input
                    value={branchDraft.domain}
                    onChange={(e) => setBranchDraft({ ...branchDraft, domain: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Legal Entity *</Label>
                  <Input
                    value={branchDraft.legalEntity}
                    onChange={(e) => setBranchDraft({ ...branchDraft, legalEntity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Authorised FSP Number *</Label>
                  <Input
                    value={branchDraft.fspNumber}
                    onChange={(e) => setBranchDraft({ ...branchDraft, fspNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Reception Telephone *</Label>
                  <Input
                    value={branchDraft.receptionNumber}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, receptionNumber: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>WhatsApp Number (Optional)</Label>
                  <Input
                    value={branchDraft.whatsappNumber}
                    placeholder="e.g. 082 512 5405 (blank if none)"
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, whatsappNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Branch Enquiries Email *</Label>
                  <Input
                    type="email"
                    value={branchDraft.email}
                    onChange={(e) => setBranchDraft({ ...branchDraft, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={branchDraft.city}
                    onChange={(e) => setBranchDraft({ ...branchDraft, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Province *</Label>
                  <Input
                    value={branchDraft.province}
                    onChange={(e) => setBranchDraft({ ...branchDraft, province: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Physical Street Address *</Label>
                  <Input
                    value={branchDraft.physicalAddress}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, physicalAddress: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Postal Address (Optional)</Label>
                  <Input
                    value={branchDraft.postalAddress}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, postalAddress: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Sales Trading Hours *</Label>
                  <Input
                    value={branchDraft.salesHours}
                    onChange={(e) => setBranchDraft({ ...branchDraft, salesHours: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Service &amp; Parts Trading Hours *</Label>
                  <Input
                    value={branchDraft.serviceHours}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, serviceHours: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>VW Roadside Assist *</Label>
                  <Input
                    value={branchDraft.roadsideAssist}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, roadsideAssist: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>VW Financial Services *</Label>
                  <Input
                    value={branchDraft.vwFinancialServices}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, vwFinancialServices: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>VolkswagenSure *</Label>
                  <Input
                    value={branchDraft.volkswagensure}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, volkswagensure: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* AutoTrader Dealer Integration Settings */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#091224]">
                      AutoTrader Stock Sync Integration
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Leave Dealer ID &amp; URL blank and disable sync if this branch is not listed on AutoTrader (manual vehicle entry remains active).
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#091224] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(branchDraft.syncEnabled)}
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, syncEnabled: e.target.checked })
                      }
                    />
                    <span>AutoTrader Sync Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>AutoTrader Dealer ID</Label>
                    <Input
                      value={branchDraft.autotraderDealerId ?? ''}
                      placeholder="e.g. 168682 (blank if none)"
                      onChange={(e) =>
                        setBranchDraft({
                          ...branchDraft,
                          autotraderDealerId: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>AutoTrader Dealer Showroom URL</Label>
                    <Input
                      type="url"
                      value={branchDraft.autotraderUrl ?? ''}
                      placeholder="https://www.autotrader.co.za/dealer/..."
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, autotraderUrl: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Google Maps Embed URL *</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setBranchDraft({
                        ...branchDraft,
                        mapEmbedUrl: toGoogleMapsEmbedUrl(branchDraft.physicalAddress),
                      })
                    }
                    className="text-xs font-semibold text-[#00437A] hover:underline cursor-pointer"
                  >
                    Auto-Generate from Physical Address
                  </button>
                </div>
                <Input
                  value={branchDraft.mapEmbedUrl}
                  onChange={(e) => setBranchDraft({ ...branchDraft, mapEmbedUrl: e.target.value })}
                  required
                />
              </div>
            </form>
          </div>
        )}

        {/* NEWS TAB */}
        {activeTab === 'news' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-[#091224]">
                Motoring News Articles
              </h2>
              <Button
                onClick={() =>
                  setEditingNews({
                    id: `news-${Date.now()}`,
                    title: '',
                    category: 'Dealership News',
                    publishedDate: todayISO,
                    readTime: '3 min read',
                    excerpt: '',
                    bodyText: '',
                    featured: false,
                    archived: false,
                    imageSrc: '/assets/aistudio/motoringNews1_18472e5f.jpg',
                  })
                }
              >
                <Plus className="h-4 w-4" />
                <span>Publish News Article</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredNews.map((article) => (
                <div
                  key={article.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4"
                >
                  <div className="flex gap-4">
                    <img
                      src={article.imageSrc}
                      alt={article.title}
                      className="h-20 w-28 rounded-lg object-cover border border-[#E2E8F0] shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#00437A]">
                        {article.category} · {article.publishedDate}
                        {article.featured ? ' · Featured' : ''}
                        {article.archived ? ' · Archived' : ''}
                      </p>
                      <h3 className="font-display text-base font-semibold text-[#091224]">
                        {article.title}
                      </h3>
                      <p className="text-xs text-[#475569] line-clamp-2">{article.excerpt}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingNews({ ...article })}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await deleteNews(article.id);
                        showFlash(`Deleted article "${article.title}".`);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADS TAB */}
        {activeTab === 'leads' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-[#091224]">
                Customer Leads &amp; Booking Inbox
              </h2>
              <Select
                value={leadBranchFilter}
                onChange={(e) => setLeadBranchFilter(e.target.value as 'All' | DealershipId)}
                className="w-56 bg-white"
              >
                <option value="All">Submitted at Any Branch</option>
                {allDealerships.map((b) => (
                  <option key={b.id} value={b.id}>
                    From Site: {b.shortName} (ID {b.id})
                  </option>
                ))}
              </Select>
            </div>

            {sortedLeads.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center text-sm text-[#475569]">
                No customer requests match your filter. Submissions across Newcastle, Ermelo, and Vryheid appear here in real time.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedLeads.map((lead) => {
                  const submittedBranch = dealershipsById[lead.submittedAtDealershipId];
                  const homeBranch = lead.homeDealershipId
                    ? dealershipsById[lead.homeDealershipId]
                    : null;

                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[#001E50]/10 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[#001E50]">
                              {lead.leadType}
                            </span>
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00437A]">
                              From Site: {submittedBranch?.shortName ?? `ID ${lead.submittedAtDealershipId}`}
                            </span>
                            {homeBranch && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#334155]">
                                Stock Branch: {homeBranch.shortName}
                              </span>
                            )}
                            <span className="font-mono text-xs text-[#64748B]">{lead.id}</span>
                          </div>
                          <h3 className="font-display text-base font-semibold text-[#091224]">
                            {lead.subject}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={lead.status}
                            onChange={(e) =>
                              void updateLeadStatus(
                                lead.id,
                                e.target.value as CmsLeadSubmission['status']
                              )
                            }
                            className="w-36"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="archived">Archived</option>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteLead(lead.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs text-[#334155] sm:grid-cols-3">
                        <p>
                          <strong className="text-[#091224]">Customer:</strong> {lead.fullName}
                        </p>
                        <p>
                          <strong className="text-[#091224]">Phone:</strong>{' '}
                          <span className="font-mono">{lead.phone}</span>
                        </p>
                        <p>
                          <strong className="text-[#091224]">Email:</strong> {lead.email}
                        </p>
                      </div>
                      <p className="rounded-lg bg-[#F8FAFC] p-3 font-mono text-xs text-[#475569] whitespace-pre-wrap leading-relaxed">
                        {lead.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VEHICLE ADD/EDIT MODAL */}
      {editingVehicle && (
        <Dialog
          open
          onClose={() => setEditingVehicle(null)}
          title="Save Master Group Stock Vehicle"
          subtitle="All available stock automatically appears across Newcastle, Ermelo & Vryheid sites with its Holding Branch badge."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const extraUrls = editingVehicle.extraImagesText
                .split(/[\n,]+/)
                .map((u) => u.trim())
                .filter(Boolean);
              const combinedImages = [editingVehicle.images[0], ...extraUrls].filter(Boolean);

              await saveVehicle({
                ...editingVehicle,
                images: combinedImages,
              });
              setEditingVehicle(null);
              showFlash(`Saved "${editingVehicle.title}" to Master Group Stock.`);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Vehicle Display Title *</Label>
                <Input
                  value={editingVehicle.title}
                  placeholder="e.g. 2026 Volkswagen T-Cross 1.0 TSI R-Line"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, title: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Model / Derivative *</Label>
                <Input
                  value={editingVehicle.model}
                  placeholder="e.g. T-Cross 1.0 TSI R-Line DSG"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, model: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Holding Dealership *</Label>
                <Select
                  value={editingVehicle.homeDealershipId}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      homeDealershipId: e.target.value as DealershipId,
                    })
                  }
                >
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Category *</Label>
                <Select
                  value={editingVehicle.category}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      category: e.target.value as CmsVehicle['category'],
                    })
                  }
                >
                  <option value="New">New</option>
                  <option value="MasterCars">MasterCars</option>
                  <option value="Used">Used</option>
                </Select>
              </div>
              <div>
                <Label>Inventory Status *</Label>
                <Select
                  value={editingVehicle.status}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      status: e.target.value as VehicleStatus,
                    })
                  }
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <Label>Year *</Label>
                <Input
                  type="number"
                  min={2010}
                  max={2035}
                  value={editingVehicle.year}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, year: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label>Selling Price (ZAR) *</Label>
                <Input
                  type="number"
                  min={1000}
                  value={editingVehicle.price}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, price: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label>Monthly From (ZAR) *</Label>
                <Input
                  type="number"
                  min={100}
                  value={editingVehicle.monthlyFrom}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      monthlyFrom: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Mileage (km) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingVehicle.mileage}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, mileage: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Body Style *</Label>
                <Select
                  value={editingVehicle.bodyStyle}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      bodyStyle: e.target.value as CmsVehicle['bodyStyle'],
                    })
                  }
                >
                  <option value="Hatchbacks & Sedans">Hatchbacks &amp; Sedans</option>
                  <option value="SUVs">SUVs</option>
                  <option value="Commercial">Commercial</option>
                </Select>
              </div>
              <div>
                <Label>Transmission *</Label>
                <Input
                  value={editingVehicle.transmission}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, transmission: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Fuel Type *</Label>
                <Input
                  value={editingVehicle.fuelType}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, fuelType: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Power Output (Optional)</Label>
                <Input
                  value={editingVehicle.powerKw}
                  placeholder="Optional (e.g. 85 kW)"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, powerKw: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fuel Economy (Optional)</Label>
                <Input
                  value={editingVehicle.fuelEconomy}
                  placeholder="Optional (e.g. 5.6 L/100km)"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, fuelEconomy: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Exterior Colour *</Label>
                <Input
                  value={editingVehicle.colour}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, colour: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <ImageSourceField
              value={editingVehicle.images[0] ?? ''}
              onChange={(url) =>
                setEditingVehicle({
                  ...editingVehicle,
                  images: [url, ...editingVehicle.images.slice(1)],
                })
              }
            />

            <div>
              <Label>Additional Gallery Image URLs (Optional, one per line)</Label>
              <Textarea
                rows={2}
                value={editingVehicle.extraImagesText}
                placeholder="https://... or /assets/..."
                onChange={(e) =>
                  setEditingVehicle({ ...editingVehicle, extraImagesText: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingVehicle(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Vehicle</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PROMOTION / EVENT / COMPETITION MODAL WITH 4-OPTION VISIBILITY SELECTOR */}
      {editingPromo && (
        <Dialog
          open
          onClose={() => setEditingPromo(null)}
          title="Save Special, Event, or Competition"
          subtitle="Select visibility across all dealerships or a single branch, and set an automatic expiry date."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const scope: PromotionScope =
                editingPromo.visibilityChoice === 'MASTER' ? 'MASTER' : 'BRANCH';
              const dealershipId: DealershipId | null =
                editingPromo.visibilityChoice === 'MASTER' ? null : editingPromo.visibilityChoice;

              await savePromotion({
                ...editingPromo,
                scope,
                dealershipId,
              });
              setEditingPromo(null);
              showFlash(`Saved "${editingPromo.title}".`);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Campaign Title *</Label>
                <Input
                  value={editingPromo.title}
                  onChange={(e) => setEditingPromo({ ...editingPromo, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Campaign Type *</Label>
                <Select
                  value={editingPromo.type}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      type: e.target.value as PromotionType,
                    })
                  }
                >
                  <option value="special">Monthly Special</option>
                  <option value="event">Dealership Event</option>
                  <option value="competition">Competition / Prize Draw</option>
                </Select>
              </div>
            </div>

            {/* 4-Option Visibility Selector */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Visibility Scope *</Label>
                <Select
                  value={editingPromo.visibilityChoice}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      visibilityChoice: e.target.value as VisibilityChoice,
                    })
                  }
                >
                  <option value="MASTER">All Dealerships (Master)</option>
                  <option value="1">Newcastle VW Only (ID 1)</option>
                  <option value="2">Ermelo VW Only (ID 2)</option>
                  <option value="3">Vryheid VW Only (ID 3)</option>
                </Select>
              </div>
              <div>
                <Label>Valid Until / Event Date (YYYY-MM-DD) *</Label>
                <Input
                  type="date"
                  value={editingPromo.validUntil}
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, validUntil: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Associated Model / Subtitle</Label>
                <Input
                  value={editingPromo.vehicleName}
                  placeholder="e.g. Volkswagen T-Cross"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, vehicleName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Offer Price (ZAR, 0 if N/A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingPromo.offerPrice}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      offerPrice: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Monthly From (ZAR, 0 if N/A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingPromo.monthlyFrom}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      monthlyFrom: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Event / Operating Time (Optional)</Label>
                <Input
                  value={editingPromo.eventTime}
                  placeholder="e.g. 09:00 – 13:00"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, eventTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Location / Venue Label</Label>
                <Input
                  value={editingPromo.location}
                  placeholder="e.g. 52 Kerk Street, Ermelo"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, location: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Campaign Description *</Label>
              <Textarea
                rows={3}
                value={editingPromo.description}
                onChange={(e) =>
                  setEditingPromo({ ...editingPromo, description: e.target.value })
                }
                required
              />
            </div>

            <ImageSourceField
              value={editingPromo.imageUrl}
              onChange={(url) => setEditingPromo({ ...editingPromo, imageUrl: url })}
            />

            <label className="flex items-center gap-2 text-xs text-[#334155]">
              <input
                type="checkbox"
                checked={editingPromo.active}
                onChange={(e) => setEditingPromo({ ...editingPromo, active: e.target.checked })}
              />
              <span>Publish Live (if Valid Until is today or later)</span>
            </label>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingPromo(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Campaign</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* BRING BACK ARCHIVED PROMOTION MODAL */}
      {reactivatingPromo && (
        <Dialog
          open
          onClose={() => setReactivatingPromo(null)}
          title="Bring Back Campaign with New Date"
          subtitle={reactivatingPromo.title}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await reactivatePromotion(reactivatingPromo.id, reactivateExpiryDate);
              setReactivatingPromo(null);
              showFlash(`Reactivated "${reactivatingPromo.title}" through ${reactivateExpiryDate}.`);
            }}
            className="space-y-4"
          >
            <div>
              <Label>New Valid Until / Expiry Date *</Label>
              <Input
                type="date"
                min={todayISO}
                value={reactivateExpiryDate}
                onChange={(e) => setReactivateExpiryDate(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setReactivatingPromo(null)}>
                Cancel
              </Button>
              <Button type="submit">Restore &amp; Publish</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* NEWS MODAL */}
      {editingNews && (
        <Dialog
          open
          onClose={() => setEditingNews(null)}
          title="Publish or Edit Motoring News"
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveNews(editingNews);
              setEditingNews(null);
              showFlash(`Saved article "${editingNews.title}".`);
            }}
            className="space-y-4"
          >
            <div>
              <Label>Article Headline *</Label>
              <Input
                value={editingNews.title}
                onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Category *</Label>
                <Input
                  value={editingNews.category}
                  onChange={(e) => setEditingNews({ ...editingNews, category: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Published Date Label *</Label>
                <Input
                  value={editingNews.publishedDate}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, publishedDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Read Time</Label>
                <Input
                  value={editingNews.readTime}
                  onChange={(e) => setEditingNews({ ...editingNews, readTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Summary Excerpt *</Label>
              <Textarea
                rows={2}
                value={editingNews.excerpt}
                onChange={(e) => setEditingNews({ ...editingNews, excerpt: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Full Article Body (separate paragraphs with blank lines) *</Label>
              <Textarea
                rows={5}
                value={editingNews.bodyText}
                onChange={(e) => setEditingNews({ ...editingNews, bodyText: e.target.value })}
                required
              />
            </div>
            <ImageSourceField
              value={editingNews.imageSrc}
              onChange={(url) => setEditingNews({ ...editingNews, imageSrc: url })}
            />
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-xs text-[#334155]">
                <input
                  type="checkbox"
                  checked={editingNews.featured}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, featured: e.target.checked })
                  }
                />
                <span>Featured Story</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-[#334155]">
                <input
                  type="checkbox"
                  checked={editingNews.archived}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, archived: e.target.checked })
                  }
                />
                <span>Archive (hide from site)</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingNews(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Article</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PASTE AUTOTRADER JSON / DECODO EXPORT MODAL */}
      {showJsonImportModal && (
        <Dialog
          open
          onClose={() => setShowJsonImportModal(false)}
          title="Paste AutoTrader JSON / Decodo Output"
          subtitle="Import AutoTrader dealer listings directly into Master Group Stock using your authenticated Admin session."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              setSyncError(null);
              try {
                const report = await importAutoTraderJson(
                  jsonImportRaw,
                  jsonImportBranchId,
                  jsonImportReconcile
                );
                setSyncReport(report);
                setShowJsonImportModal(false);
                setJsonImportRaw('');
                showFlash('Imported AutoTrader vehicle listings into Master Group Stock.');
              } catch (err) {
                setSyncError(
                  err instanceof Error ? err.message : 'Unable to parse and import AutoTrader JSON.'
                );
              } finally {
                setBusyAction(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Default Target Holding Branch *</Label>
                <Select
                  value={jsonImportBranchId}
                  onChange={(e) => setJsonImportBranchId(e.target.value as DealershipId)}
                >
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() =>
                    setJsonImportRaw(
                      JSON.stringify(
                        [
                          {
                            listingId: '28194501',
                            title: '2025 Volkswagen Polo 1.0 TSI Life DSG',
                            year: 2025,
                            price: 389900,
                            mileage: 14200,
                            transmission: 'Automatic',
                            fuelType: 'Petrol',
                            category: 'MasterCars',
                            images: ['/assets/online/vw-polo-2024.jpg'],
                            canonicalUrl:
                              'https://www.autotrader.co.za/car-for-sale/volkswagen/polo/newcastle/28194501',
                          },
                        ],
                        null,
                        2
                      )
                    )
                  }
                  className="text-xs font-semibold text-[#00437A] hover:underline cursor-pointer"
                >
                  Insert Sample JSON Template
                </button>
              </div>
            </div>

            <div>
              <Label>AutoTrader JSON Array, Decodo Response JSON, or Dealer HTML *</Label>
              <Textarea
                rows={10}
                value={jsonImportRaw}
                onChange={(e) => setJsonImportRaw(e.target.value)}
                placeholder='Paste JSON array ([{ "listingId": "...", "title": "...", "price": 399900, ... }]) or raw Decodo { "results": [{ "content": "<html>..." }] }'
                className="font-mono text-xs"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={jsonImportReconcile}
                onChange={(e) => setJsonImportReconcile(e.target.checked)}
              />
              <span>
                Mark existing AutoTrader vehicles at this branch as Sold if omitted from this import (manual vehicles are never modified)
              </span>
            </label>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setShowJsonImportModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction}>
                <Upload className="h-4 w-4" />
                <span>{busyAction ? 'Importing...' : 'Import to Firestore'}</span>
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
